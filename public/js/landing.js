const createButton = document.querySelector("#createroom");
const videoCont = document.querySelector('.video-self');
const codeCont = document.querySelector('#roomcode');
const joinBut = document.querySelector('#joinroom');
const mic = document.querySelector('#mic');
const cam = document.querySelector('#webcam');

// mediapipe canvas
const mediapipeCanvas = document.createElement("canvas");
mediapipeCanvas.style.width = 640;
mediapipeCanvas.style.height = 480;
const mediapipeCtx = mediapipeCanvas.getContext("2d");


function onResults(results){
    mediapipeCtx.save();
    mediapipeCtx.clearRect(0, 0, mediapipeCanvas.width, mediapipeCanvas.height);

    // Only overwrite existing pixels.
    mediapipeCtx.globalCompositeOperation = 'source-in';
    mediapipeCtx.fillStyle = '#00FF00';
    mediapipeCtx.fillRect(0, 0, mediapipeCanvas.width, mediapipeCanvas.height);

    // Only overwrite missing pixels.
    mediapipeCtx.globalCompositeOperation = 'destination-atop';
    mediapipeCtx.drawImage(
        results.image, 0, 0, mediapipeCanvas.width, mediapipeCanvas.height);

    mediapipeCtx.globalCompositeOperation = 'source-over';
    drawConnectors(mediapipeCtx, results.poseLandmarks, POSE_CONNECTIONS,
                    {color: '#00FF00', lineWidth: 4});
    drawLandmarks(mediapipeCtx, results.poseLandmarks,
                    {color: '#FF0000', lineWidth: 2});
    drawConnectors(mediapipeCtx, results.faceLandmarks, FACEMESH_TESSELATION,
                    {color: '#C0C0C070', lineWidth: 1});
    drawConnectors(mediapipeCtx, results.leftHandLandmarks, HAND_CONNECTIONS,
                    {color: '#CC0000', lineWidth: 5});
    drawLandmarks(mediapipeCtx, results.leftHandLandmarks,
                    {color: '#00FF00', lineWidth: 2});
    drawConnectors(mediapipeCtx, results.rightHandLandmarks, HAND_CONNECTIONS,
                    {color: '#00CC00', lineWidth: 5});
    drawLandmarks(mediapipeCtx, results.rightHandLandmarks,
                    {color: '#FF0000', lineWidth: 2});
    mediapipeCtx.restore();
}

let micAllowed = 1;
let camAllowed = 1;

let mediaConstraints = { video: true, audio: true };

const holistic = new Holistic({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
}});


holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: true,
    smoothSegmentation: true,
    refineFaceLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
holistic.onResults(onResults);

const videoElement = document.createElement("video");

function getMediapipeStream(localstream, video, audio){
    videoElement.srcObject = localstream;
    const camera = new Camera(videoElement, {
        onFrame: async () => {
        await holistic.send({image: videoElement});
        },
        width: 640,
        height: 480
    });
    camera.start();

    let mediapipeStream = new MediaStream();

    if (video){
        mediapipeCanvas.captureStream().getTracks().forEach((track) => {
            mediapipeStream.addTrack(track);
        })
    }
    if (audio){
        localstream.getAudioTracks().forEach((track) => {
            mediapipeStream.addTrack(track);
        })
    }

    return mediapipeStream;

}


navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(localstream => {

        let mstream = getMediapipeStream(localstream, true, true);

        videoCont.srcObject = mstream;
})


function uuidv4() {
    return 'xxyxyxxyx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const createroomtext = 'Creating Room...';

createButton.addEventListener('click', (e) => {
    e.preventDefault();
    createButton.disabled = true;
    createButton.innerHTML = 'Creating Room';
    createButton.classList = 'createroom-clicked';

    setInterval(() => {
        if (createButton.innerHTML < createroomtext) {
            createButton.innerHTML = createroomtext.substring(0, createButton.innerHTML.length + 1);
        }
        else {
            createButton.innerHTML = createroomtext.substring(0, createButton.innerHTML.length - 3);
        }
    }, 500);

    //const name = nameField.value;
    location.href = `/room.html?room=${uuidv4()}`;
});

joinBut.addEventListener('click', (e) => {
    e.preventDefault();
    if (codeCont.value.trim() == "") {
        codeCont.classList.add('roomcode-error');
        return;
    }
    const code = codeCont.value;
    location.href = `/room.html?room=${code}`;
})

codeCont.addEventListener('change', (e) => {
    e.preventDefault();
    if (codeCont.value.trim() !== "") {
        codeCont.classList.remove('roomcode-error');
        return;
    }
})

cam.addEventListener('click', () => {
    if (camAllowed) {

        mediaConstraints = { video: false, audio: true };

        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })

        cam.classList = "nodevice";
        cam.innerHTML = `<i class="fas fa-video-slash"></i>`;
        camAllowed = 0;
    }
    else {

        if (micAllowed){
            mediaConstraints = { video: true, audio: true };
            navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
        
                let mstream = getMediapipeStream(localstream, true, true);
        
                videoCont.srcObject = mstream;

            })
        } else {
            mediaConstraints = { video: true, audio: false };

            navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                let mstream = getMediapipeStream(localstream, true, false);
        
                videoCont.srcObject = mediapipeStream;
            })

        }

        cam.classList = "device";
        cam.innerHTML = `<i class="fas fa-video"></i>`;
        camAllowed = 1;
    }
})

mic.addEventListener('click', () => {
    if (micAllowed) {

        if (camAllowed){
            mediaConstraints = {video: true, audio: false};

            navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
        
                let mstream = getMediapipeStream(localstream, true, false);
        
                videoCont.srcObject = mstream;

            })

        } 

        mic.classList = "nodevice";
        mic.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        micAllowed = 0;
    }
    else {
        if (camAllowed){
            mediaConstraints = { video: true, audio: true };
            navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
        
                let mstream = getMediapipeStream(localstream, true, true)
        
                videoCont.srcObject = mstream;
                
            })
        } else {
            mediaConstraints = { video: false, audio: true };

            navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localstream => {
                videoCont.srcObject = localstream;
            })
        }

        mic.innerHTML = `<i class="fas fa-microphone"></i>`;
        mic.classList = "device";
        micAllowed = 1;
    }
})
