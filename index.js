// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import {
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils
} from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");

let poseLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";

// Before we can use PoseLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createPoseLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
        },
        runningMode: runningMode,
        numPoses: 2
    });
    demosSection.classList.remove("invisible");
    document.getElementById("loadingMsg").style.display = "none";
};
createPoseLandmarker();

const videoSelector = document.getElementById("videoSelector");
// const video = document.getElementById("video");
const video = document.querySelector("video")
// Load the video when the user selects one
videoSelector.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    // video file の縦横比をfileから取得

    video.src = URL.createObjectURL(file);
    video.addEventListener("loadedmetadata", async () => {
        console.log("video.duration : ", video.duration);
        console.log("video.currentTime : ", video.currentTime);
        console.log("video.videoWidth : ", video.videoWidth);
        console.log("video.videoHeight : ", video.videoHeight);
        // 動画の再生を開始
        video.play();
        // 動画を0.5秒ごとにキャプチャして表示
        const frameInterval = 0.5;
        let frameNumber = -1;
        const frameIntervalCapture = setInterval(async () => {
            frameNumber++;
            getFrame(frameNumber);
            if (video.currentTime + 2 * frameInterval > video.duration) {
                // 動画の再生が終了したらframeIntervalCaptureを停止
                clearInterval(frameIntervalCapture);
            }
        }, frameInterval * 1000);

        // setTimeoutでposeLandmarker.detectを呼び出す
        setTimeout(async () => {
            if (!poseLandmarker) {
                console.log("poseLandmarker is not ready yet.");
                return;
            }
            if (runningMode == "VIDEO") {
                runningMode = "IMAGE";
                poseLandmarker.setOptions({ runningMode: "IMAGE" });
            }
            console.log("ready to process video");
            const frameImageWrapper = document.getElementById("frameImageWrapper");
            console.log("frameImageWrapper.childElementCount : ");
            console.log(frameImageWrapper.childElementCount);
            console.log(frameImageWrapper.children);
            // 1秒ごとにposeLandmarker.detectを呼び出す
            let i = -1;
            const frameIntervalDetect = setInterval(async () => {
                if (i >= frameImageWrapper.childElementCount) {
                    clearInterval(frameIntervalDetect);
                }
                // if (frameImageWrapper.children[i] == undefined) {
                //     clearInterval(frameIntervalDetect);
                // }
                i++;
                const image = frameImageWrapper.children[i];
                const poseCanvas = document.createElement("canvas");
                poseCanvas.setAttribute("class", "canvas");
                poseCanvas.setAttribute("width", image.style.width);
                poseCanvas.setAttribute("height", image.style.height);
                poseCanvas.style.left = image.offsetLeft + "px";
                poseCanvas.style.top = image.offsetTop + "px";
                frameImageWrapper.appendChild(poseCanvas);
                console.log("created image and canvas : " + image.id);
                await poseLandmarker.detect(image, async (result) => {
                    const poseCanvasCtx = poseCanvas.getContext("2d");
                    const drawingUtils = new DrawingUtils(poseCanvasCtx);
                    for (const landmark of result.landmarks) {
                        drawingUtils.drawLandmarks(landmark, {
                            radius: (data) => DrawingUtils.lerp(data.from?.z ?? 0, -0.15, 0.1, 5, 1)
                        });
                        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
                    }
                })
                console.log("finished processing video frame : " + image.id);
            }, 1500);

            // const image0 = frameImageWrapper.children[0];
            // const poseCanvas0 = document.createElement("canvas");
            // poseCanvas0.setAttribute("class", "canvas");
            // poseCanvas0.setAttribute("width", image0.style.width);
            // poseCanvas0.setAttribute("height", image0.style.height);
            // poseCanvas0.style.left = image0.offsetLeft + "px";
            // poseCanvas0.style.top = image0.offsetTop + "px";
            // frameImageWrapper.appendChild(poseCanvas0);
            // console.log("created image and canvas : " + image0.id);
            // await poseLandmarker.detect(image0, async (result) => {
            //     const poseCanvasCtx = poseCanvas0.getContext("2d");
            //     const drawingUtils = new DrawingUtils(poseCanvasCtx);
            //     for (const landmark of result.landmarks) {
            //         drawingUtils.drawLandmarks(landmark, {
            //             radius: (data) => DrawingUtils.lerp(data.from?.z ?? 0, -0.15, 0.1, 5, 1)
            //         });
            //         drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
            //     }
            // })
            // console.log("finished processing video frame : " + image0.id);

            console.log("finished processing video");
        }, video.duration * 1000 + 2000);



        function getFrame(num) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = document.createElement("img")
            image.id = "videoFrame" + num;
            image.style.width = "50px";
            image.style.height = "50px";
            image.style.margin = "2px";
            image.crossOrigin = "anonymous"
            image.loading = "lazy"
            image.src = canvas.toDataURL();
            const videoFrameWrapper = document.getElementById("videoFrameWrapper");
            videoFrameWrapper.appendChild(image);
            const image2 = document.createElement("img")
            image2.id = "frameImage" + num;
            image2.style.width = (0.25*video.videoWidth) + "px";
            image2.style.height = (0.25*video.videoHeight) + "px";
            image2.style.margin = "2px";
            image2.crossOrigin = "anonymous"
            image2.loading = "lazy"
            image2.src = canvas.toDataURL();
            const frameImageWrapper = document.getElementById("frameImageWrapper");
            frameImageWrapper.appendChild(image2);
        }



    });

});



