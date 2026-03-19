# Uptoskill-Hackathon
An AIML project for blind people using phone that  detects the object and after detecting the speed to  recognition in pyhton a voice is send to blind people ear through buds that tell object name 
import cv2

# Connect to mobile camera via IP Webcam
MOBILE_IP = "http://192.168.1.5:8080/video"  # Replace with your IP
cap = cv2.VideoCapture(MOBILE_IP)

while True:
    ret, frame = cap.read()
    if not ret:
        break
    cv2.imshow("Mobile Camera Feed", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
