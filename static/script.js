document.addEventListener('DOMContentLoaded', () => {
    const listElement = document.getElementById('detections-list');
    const btnAudio = document.getElementById('activate-audio');
    const audioStatus = document.getElementById('audio-status');
    
    let isAudioEnabled = false;
    let lastSpoken = {};
    const SPEECH_COOLDOWN = 3000; // 3 seconds in ms

    // Initialize Web Speech API
    const synth = window.speechSynthesis;

    // Wait for voices to load
    let voice = null;
    function loadVoices() {
        const voices = synth.getVoices();
        // Try to pick a natural-sounding English voice
        voice = voices.find(v => v.lang.includes('en-US') && v.name.includes('Google')) || 
                voices.find(v => v.lang.includes('en')) || voices[0];
    }
    
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Toggle Audio Assistance
    btnAudio.addEventListener('click', () => {
        isAudioEnabled = !isAudioEnabled;
        
        if (isAudioEnabled) {
            btnAudio.classList.add('active');
            btnAudio.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
                <span>Audio Active</span>
            `;
            audioStatus.textContent = "Listening";
            audioStatus.style.color = "var(--live-color)";
            
            // Speak a greeting to confirm activation
            const utterance = new SpeechSynthesisUtterance("Vision Assistant Active");
            if (voice) utterance.voice = voice;
            synth.speak(utterance);
        } else {
            btnAudio.classList.remove('active');
            btnAudio.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                </svg>
                <span>Activate Assistant</span>
            `;
            audioStatus.textContent = "Standby";
            audioStatus.style.color = "inherit";
            synth.cancel(); // Stop talking
        }
    });

    function speakObject(label) {
        if (!isAudioEnabled) return;

        const now = Date.now();
        // Prevent repeating the same object too frequently
        if (!lastSpoken[label] || (now - lastSpoken[label]) > SPEECH_COOLDOWN) {
            lastSpoken[label] = now;
            
            const utterance = new SpeechSynthesisUtterance(`I see a ${label}`);
            if (voice) utterance.voice = voice;
            utterance.rate = 1.1; // Slightly faster for responsiveness
            utterance.pitch = 1.0;
            
            synth.speak(utterance);
        }
    }

    // Polling Backend API for Detections
    async function fetchDetections() {
        try {
            const response = await fetch('/get_detections');
            if (response.ok) {
                const data = await response.json();
                const detections = data.detections || [];
                
                // Update UI list
                if (detections.length === 0) {
                    listElement.innerHTML = '<li class="empty-state">No objects detected.</li>';
                } else {
                    listElement.innerHTML = ''; // Clear list
                    detections.forEach(label => {
                        const li = document.createElement('li');
                        li.textContent = label.charAt(0).toUpperCase() + label.slice(1);
                        listElement.appendChild(li);
                        
                        // Speak object
                        speakObject(label);
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching detections data:", error);
        }
    }

    // Poll every 800ms
    setInterval(fetchDetections, 800);

    // --- Settings Logic ---
    const streamInput = document.getElementById('stream-input');
    const updateStreamBtn = document.getElementById('update-stream-btn');
    const backendAudioToggle = document.getElementById('backend-audio-toggle');

    updateStreamBtn.addEventListener('click', async () => {
        const streamUrl = streamInput.value;
        try {
            const response = await fetch('/update_stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stream_url: streamUrl })
            });
            if (response.ok) {
                const originalText = updateStreamBtn.textContent;
                updateStreamBtn.textContent = "Updated!";
                updateStreamBtn.style.background = "var(--live-color)";
                updateStreamBtn.style.borderColor = "var(--live-color)";
                
                // Refresh video feed to reconnect
                const videoStream = document.getElementById('video-stream');
                const currentSrc = videoStream.src.split('?')[0];
                videoStream.src = currentSrc + "?t=" + new Date().getTime();

                setTimeout(() => {
                    updateStreamBtn.textContent = originalText;
                    updateStreamBtn.style.background = "";
                    updateStreamBtn.style.borderColor = "";
                }, 2000);
            }
        } catch(e) {
            console.error("Error updating stream:", e);
        }
    });

    backendAudioToggle.addEventListener('change', async (e) => {
        const isEnabled = e.target.checked;
        try {
            await fetch('/update_stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backend_audio: isEnabled })
            });
        } catch(e) {
            console.error("Error toggling backend audio:", e);
        }
    });
});
