const createButton = document.querySelector("#createroom");
const videoCont = document.querySelector('.video-self');
const codeCont = document.querySelector('#roomcode');
const joinBut = document.querySelector('#joinroom');
const mic = document.querySelector('#mic');
const cam = document.querySelector('#webcam');
const vrmfile = document.querySelector("#vrmfile")

const videoWidth = 640;
const videoHeight = 480;

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

    animateVRM(currentVrm, results);
}

let micAllowed = 1;
let camAllowed = 1;

let mediaConstraints = { video: true, audio: true };

const videoElement = document.createElement("video");

function getMediapipeStream(localstream, video, audio){
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

    videoElement.srcObject = localstream;
    const camera = new Camera(videoElement, {
        onFrame: async () => {
        await holistic.send({image: videoElement});
        },
        width: videoWidth,
        height: videoHeight
    });
    camera.start();

    let mediapipeStream = new MediaStream();

    if (video){

        renderer.domElement.captureStream().getTracks().forEach((track) => {
            mediapipeStream.addTrack(track);
        })

        //mediapipeCanvas.captureStream().getTracks().forEach((track) => {
        //    mediapipeStream.addTrack(track);
        // })
    }
    if (audio){
        localstream.getAudioTracks().forEach((track) => {
            mediapipeStream.addTrack(track);
        })
    }

    return mediapipeStream;

}

/* Kalidokit settings */
const remap = Kalidokit.Utils.remap;
const clamp = Kalidokit.Utils.clamp;
const lerp = Kalidokit.Vector.lerp;

let currentVrm;

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(640, 480);
renderer.setPixelRatio(window.devicePixelRatio);

const orbitCamera = new THREE.PerspectiveCamera(35, videoWidth / videoHeight, 0.1, 1000);
orbitCamera.position.set(0.0, 1.4, 1.4);

const orbitControls = new THREE.OrbitControls(orbitCamera, renderer.domElement);
orbitControls.screenSpacePanning = true;
orbitControls.target.set(0.0, 1.4, 0.0);
orbitControls.update();

const scene = new THREE.Scene();

const light = new THREE.DirectionalLight(0xffffff);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);

const clock = new THREE.Clock();

function animate(){
    requestAnimationFrame(animate);

    if (currentVrm){
        currentVrm.update(clock.getDelta())
    }

    renderer.render(scene, orbitCamera)
}

animate();

/* VRM Character Setup */
const loader = new THREE.GLTFLoader();
loader.crossOrigin = "anonymous";

const rigRotation = (name, rotation = { x: 0, y: 0, z: 0}, dampener = 1, lerpAmount = 0.3) => {
    if (!currentVrm){
        return;
    }

    const Part = currentVrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName[name]);

    if (!Part){
        return;
    }

    let euler = new THREE.Euler(rotation.x * dampener, rotation.y * dampener, rotation.z * dampener);
    let quaternion = new THREE.Quaternion().setFromEuler(euler);
    Part.quaternion.slerp(quaternion, lerpAmount);  // interpolate
}

const rigPosition = (name, position = { x: 0, y: 0, z: 0}, dampener = 1, lerpAmount = 0.3) => {
    if (!currentVrm){
        return;
    }

    const Part = currentVrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName[name]);
    if (!Part) {
        return;
    }

    let vector = new THREE.Vector3(position.x * dampener, position.y * dampener, position.z * dampener);
    Part.position.lerp(vector, lerpAmount);
}

let oldLookTarget = new THREE.Euler();


const rigFace = (riggedFace) => {
    if (!currentVrm){
        return;
    }
    rigRotation("Neck", riggedFace.head, 0.7);

    // BlendShapes and Preset Name Schema
    const Blendshape = currentVrm.blendShapeProxy;
    const PresetName = THREE.VRMSchema.BlendShapePresetName;

    // Simple example without winking. Interpolate based on old blendshape, then stabilize blink with `Kalidokit` helper function.
    // for VRM, 1 is closed, 0 is open.
    riggedFace.eye.l = lerp(clamp(1 - riggedFace.eye.l, 0, 1), Blendshape.getValue(PresetName.Blink), 0.5);
    riggedFace.eye.r = lerp(clamp(1 - riggedFace.eye.r, 0, 1), Blendshape.getValue(PresetName.Blink), 0.5);
    riggedFace.eye = Kalidokit.Face.stabilizeBlink(riggedFace.eye, riggedFace.head.y);
    Blendshape.setValue(PresetName.Blink, riggedFace.eye.l);

    // Interpolate and set mouth blendshapes
    Blendshape.setValue(PresetName.I, lerp(riggedFace.mouth.shape.I, Blendshape.getValue(PresetName.I), 0.5));
    Blendshape.setValue(PresetName.A, lerp(riggedFace.mouth.shape.A, Blendshape.getValue(PresetName.A), 0.5));
    Blendshape.setValue(PresetName.E, lerp(riggedFace.mouth.shape.E, Blendshape.getValue(PresetName.E), 0.5));
    Blendshape.setValue(PresetName.O, lerp(riggedFace.mouth.shape.O, Blendshape.getValue(PresetName.O), 0.5));
    Blendshape.setValue(PresetName.U, lerp(riggedFace.mouth.shape.U, Blendshape.getValue(PresetName.U), 0.5));

    //PUPILS
    //interpolate pupil and keep a copy of the value
    let lookTarget = new THREE.Euler(
        lerp(oldLookTarget.x, riggedFace.pupil.y, 0.4),
        lerp(oldLookTarget.y, riggedFace.pupil.x, 0.4),
        0,
        "XYZ"
    );
    oldLookTarget.copy(lookTarget);
    currentVrm.lookAt.applyer.lookAt(lookTarget);

}


const animateVRM = (vrm, results) => {
    if (!vrm){
        return;
    }

    let riggedPose, riggedLeftHand, riggedRightHand, riggedFace;

    const faceLandmarks = results.faceLandmarks;
    const pose3DLandmarks = results.ea;
    const pose2DLandmarks = results.poseLandmarks;
    const leftHandLandmarks = results.rightHandLandmarks;
    const rightHandLandmarks = results.leftHandLandmarks;

    // animate face
    if (faceLandmarks){
        riggedFace = Kalidokit.Face.solve(faceLandmarks, {
            runtime: "mediapipe",
            video: videoElement
        });

        rigFace(riggedFace)
        
    }

    // animate Pose
    if (pose3DLandmarks && pose2DLandmarks){
        riggedPose = Kalidokit.Pose.solve(pose3DLandmarks, pose2DLandmarks, {
            runtime: "mediapipe",
            video: videoElement
        });


        rigRotation("Hips", riggedPose.Hips.rotation, 0.7);
        rigPosition(
            "Hips",
            {
                x: -riggedPose.Hips.worldPosition.x,
                y: riggedPose.Hips.worldPosition.y + 1,
                z: -riggedPose.Hips.worldPosition.z
            },
            1, 
            0.07
        );

        rigRotation("Chest", riggedPose.Spine, 0.25, 0.3);
        rigRotation("Spine", riggedPose.Spine, 0.45, 0.3);

        rigRotation("RightUpperArm", riggedPose.RightUpperArm, 1, 0.3);
        rigRotation("RightLowerArm", riggedPose.RightLowerArm, 1, 0.3);
        rigRotation("LeftUpperArm", riggedPose.LeftUpperArm, 1, 0.3);
        rigRotation("LeftLowerArm", riggedPose.LeftLowerArm, 1, 0.3);

        rigRotation("RightUpperLeg", riggedPose.RightUpperLeg, 1, 0.3);
        rigRotation("RightLowerLeg", riggedPose.RightLowerLeg, 1, 0.3);
        rigRotation("LeftUpperLeg", riggedPose.LeftUpperLeg, 1, 0.3);
        rigRotation("LeftLowerLeg", riggedPose.LeftLowerLeg, 1, 0.3);
        
    }

    if (leftHandLandmarks){
        riggedLeftHand = Kalidokit.Hand.solve(leftHandLandmarks, "Left");

        rigRotation("LeftHand", {
            z: riggedPose.LeftHand.z,
            y: riggedLeftHand.LeftWrist.y,
            x: riggedLeftHand.LeftWrist.x,
        });

        rigRotation("LeftRingProximal", riggedLeftHand.LeftRingProximal);
        rigRotation("LeftRingIntermediate", riggedLeftHand.LeftRingIntermediate);
        rigRotation("LeftRingDistal", riggedLeftHand.LeftRingDistal);
        rigRotation("LeftIndexProximal", riggedLeftHand.LeftIndexProximal);
        rigRotation("LeftIndexIntermediate", riggedLeftHand.LeftIndexIntermediate);
        rigRotation("LeftIndexDistal", riggedLeftHand.LeftIndexDistal);
        rigRotation("LeftMiddleProximal", riggedLeftHand.LeftMiddleProximal);
        rigRotation("LeftMiddleIntermediate", riggedLeftHand.LeftMiddleIntermediate);
        rigRotation("LeftMiddleDistal", riggedLeftHand.LeftMiddleDistal);
        rigRotation("LeftThumbProximal", riggedLeftHand.LeftThumbProximal);
        rigRotation("LeftThumbIntermediate", riggedLeftHand.LeftThumbIntermediate);
        rigRotation("LeftThumbDistal", riggedLeftHand.LeftThumbDistal);
        rigRotation("LeftLittleProximal", riggedLeftHand.LeftLittleProximal);
        rigRotation("LeftLittleIntermediate", riggedLeftHand.LeftLittleIntermediate);
        rigRotation("LeftLittleDistal", riggedLeftHand.LeftLittleDistal);
    }

    if (rightHandLandmarks){
        riggedRightHand = Kalidokit.Hand.solve(rightHandLandmarks, "Right");
        rigRotation("RightHand", {
            z: riggedPose.RightHand.z,
            y: riggedRightHand.RightWrist.y,
            x: riggedRightHand.RightWrist.x,
        });
        
        rigRotation("RightRingProximal", riggedRightHand.RightRingProximal);
        rigRotation("RightRingIntermediate", riggedRightHand.RightRingIntermediate);
        rigRotation("RightRingDistal", riggedRightHand.RightRingDistal);
        rigRotation("RightIndexProximal", riggedRightHand.RightIndexProximal);
        rigRotation("RightIndexIntermediate", riggedRightHand.RightIndexIntermediate);
        rigRotation("RightIndexDistal", riggedRightHand.RightIndexDistal);
        rigRotation("RightMiddleProximal", riggedRightHand.RightMiddleProximal);
        rigRotation("RightMiddleIntermediate", riggedRightHand.RightMiddleIntermediate);
        rigRotation("RightMiddleDistal", riggedRightHand.RightMiddleDistal);
        rigRotation("RightThumbProximal", riggedRightHand.RightThumbProximal);
        rigRotation("RightThumbIntermediate", riggedRightHand.RightThumbIntermediate);
        rigRotation("RightThumbDistal", riggedRightHand.RightThumbDistal);
        rigRotation("RightLittleProximal", riggedRightHand.RightLittleProximal);
        rigRotation("RightLittleIntermediate", riggedRightHand.RightLittleIntermediate);
        rigRotation("RightLittleDistal", riggedRightHand.RightLittleDistal);

    }


}




// get usermedia
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

let vrmimg;

function onLoadHandler(e){
    let raw = e.target.result;
    let ds = new DataView(raw);

    let glbMeta = getGLBMeta(ds);
    // console.log("magic " + glbMeta.magic.toString(16));
    if (glbMeta.magic !== MAGIC_glTF) {
        // console.warn("This file is not a GLB file.");
        return;
    }
    // console.log("Version " + glbMeta.version);
    // console.log("Total Length " + glbMeta.total);

    const jsonData = getJsonData(ds);
    const offset = GLB_FILE_HEADER_SIZE + GLB_CHUNK_HEADER_SIZE + jsonData.length;
    let dataChunkType = ds.getUint32(offset + GLB_CHUNK_LENGTH_SIZE, LE);

    if (dataChunkType !== GLB_CHUNK_TYPE_BIN) {
        console.warn("This GLB file doesn't have a binary buffer.");
        return;
    }

    vrmimg = getThumbnail(jsonData, ds.buffer, offset);

}

// vrm file event
vrmfile.addEventListener("change", (e) => {

    let file = e.target.files[0];
    let filename = file.name;

    let fileurl = URL.createObjectURL(file);

    if (fileurl === undefined || fileurl === null){
        fileurl = "https://cdn.glitch.com/29e07830-2317-4b15-a044-135e73c7f840%2FAshtra.vrm?v=1630342336981";
    }

    loader.load(fileurl,
            (gltf) => {
                THREE.VRMUtils.removeUnnecessaryJoints(gltf.scene);
                THREE.VRM.from(gltf).then((vrm) => {
                    scene.add(vrm.scene);
                    currentVrm = vrm;
                    currentVrm.scene.rotation.y = Math.PI;
                });
            },
            (progress) => console.log("Loading model...", 100.0 * (progress.loaded / progress.total), "%"),
            
            (error) => console.error(error)
    );


    let reader = new FileReader();
    reader.addEventListener("load", onLoadHandler, true);
    reader.addEventListener("loadend", () => {

        // send vrm file
        let vrmformData = new FormData();
        vrmformData.append("file", file)
        axios.post("/api/preview/uploadfiles", vrmformData)
        .then(response => {
            if (response.data.success){
                console.log(response.data.url);
            } else {
                alert("failed to upload vrm file");
            }
        })

        // get image rag
        let target = document.querySelector("#thumbnail");

        // create new image file
        fetch(target.src)
        .then(res => res.blob())
        .then(blob => {
            let fname = filename.split(".")[0];
            const newfile = new File([blob], `${fname}.png`, blob);
            console.log(newfile)

            // send image file to server
            let imgformData = new FormData();
            imgformData.append("file", newfile);

            axios.post("/api/preview/uploadfiles", imgformData)
            .then(response => {
                if (response.data.success){
                    console.log(response.data.url);
                } else {
                    alert("failed to upload thumbnail image")
                }
            })

        })

        // write some processes
        console.log(target);

        // confirmation
        axios.get("/api/preview/hello")
        .then(response => {
            console.log(response.data.result);
        })
    })
    reader.readAsArrayBuffer(file);

    // let target = document.querySelector("#thumbnail");

    // console.log(target);

})


// checkbutton to get vrm url
const checkbutton = document.querySelector("#checkbutton")

if (checkbutton){
    checkbutton.addEventListener("click", (e) => {
        e.preventDefault();
        const nameField = document.querySelector("#name-field");
    
        let username = nameField.value;
    
        const vrmvariables = {
            username: username 
        }
    
        axios.post("/api/preview/getvrm", vrmvariables)
        .then(response => {
            console.log(response);
        })
    
    })
}
