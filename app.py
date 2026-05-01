from flask import Flask, render_template, Response, jsonify, request
import cv2
from ultralytics import YOLO
import time
import pyttsx3
import threading

app = Flask(__name__)

# Load Model
model = YOLO("yolov8n.pt")

# Camera Stream URL
# Default to Mobile Stream as requested
MOBILE_STREAM = "http://192.168.1.5:8080/video"
CURRENT_STREAM = MOBILE_STREAM
CONFIDENCE_THRESHOLD = 0.55

# Global variables
latest_detections = []
stream_changed = False

# TTS Setup (Backend feature)
engine = pyttsx3.init()
engine.setProperty('rate', 160)
engine.setProperty('volume', 1.0)
last_spoken = {}
COOLDOWN = 3
backend_audio_enabled = True

def speak_object(label):
    global backend_audio_enabled
    if not backend_audio_enabled:
        return
    current_time = time.time()
    if label not in last_spoken or (current_time - last_spoken[label]) > COOLDOWN:
        last_spoken[label] = current_time
        def _speak():
            engine.say(f"I see a {label}")
            engine.runAndWait()
        t = threading.Thread(target=_speak)
        t.daemon = True
        t.start()

def get_camera():
    global CURRENT_STREAM
    # Attempt to connect to the current stream
    cap = cv2.VideoCapture(CURRENT_STREAM)
    if not cap.isOpened():
        print(f"Warning: Could not connect to {CURRENT_STREAM}. Falling back to default webcam (0).")
        cap = cv2.VideoCapture(0)
    return cap

def generate_frames():
    global latest_detections, stream_changed
    cap = get_camera()

    while True:
        if stream_changed:
            cap.release()
            cap = get_camera()
            stream_changed = False

        success, frame = cap.read()
        if not success:
            time.sleep(1)
            cap = get_camera()
            continue

        results = model(frame, verbose=False)
        current_detections = []

        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0])
                if conf < CONFIDENCE_THRESHOLD:
                    continue
                
                cls_id = int(box.cls[0])
                label = model.names[cls_id]
                current_detections.append(label)
                
                # Speak object if backend audio is enabled
                speak_object(label)

                # Visual feedback: Bounding Boxes
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                overlay = frame.copy()
                cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 50, 150), -1)
                alpha = 0.2
                cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 50, 150), 2)
                
                (w, h), _ = cv2.getTextSize(f"{label} {conf:.0%}", cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                cv2.rectangle(frame, (x1, y1 - 25), (x1 + w, y1), (255, 50, 150), -1)
                cv2.putText(frame, f"{label} ({conf:.0%})", (x1, y1 - 8),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        latest_detections = list(set(current_detections))

        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/get_detections')
def get_detections_api():
    global latest_detections
    return jsonify({"detections": latest_detections})

@app.route('/update_stream', methods=['POST'])
def update_stream():
    global CURRENT_STREAM, stream_changed, backend_audio_enabled
    data = request.json
    
    if 'stream_url' in data:
        new_url = data['stream_url']
        # Convert '0' to int 0 for desktop camera
        if new_url == '0' or new_url == 0:
            new_url = 0
        if new_url != CURRENT_STREAM:
            CURRENT_STREAM = new_url
            stream_changed = True
            
    if 'backend_audio' in data:
        backend_audio_enabled = data['backend_audio']
        
    return jsonify({"status": "success", "current_stream": CURRENT_STREAM, "backend_audio": backend_audio_enabled})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, threaded=True)