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
let runningMode = "VIDEO";
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

    video.src = URL.createObjectURL(file);
    console.log("video.videoWidth : ", video.videoWidth);
    console.log("video.videoHeight : ", video.videoHeight);
    
    video.addEventListener("loadedmetadata", async () => {
        console.log("video.duration : ", video.duration);
        console.log("video.currentTime : ", video.currentTime);


        const output_canvas = document.getElementById("output_canvas");
        output_canvas.width = video.videoWidth;
        output_canvas.height = video.videoHeight;
        output_canvas.style.top = video.offsetTop + "px";
        output_canvas.style.left = video.offsetLeft + "px";
        output_canvas.style.position = "absolute";
        output_canvas.style.zIndex = "1";

        const canvasCtx = output_canvas.getContext("2d");
        const drawingUtils = new DrawingUtils(canvasCtx);



        if (!poseLandmarker) {
            console.log("poseLandmarker is not ready yet.");
            return;
        }
        if (runningMode == "IMAGE") {
            runningMode = "VIDEO";
            poseLandmarker.setOptions({ runningMode: "VIDEO" });
        }
        let lastVideoTime = -1;
        console.log("performance.now() : ", performance.now());
        // detectForVideo()の準備が整ってから動画の再生を開始
        // video.play();
        // videoがplayし始めたら、predictVideo()を呼び出す
        let landmarksList = [];
        video.addEventListener("play", predictVideo);
        setTimeout(() => {
            // 消音で再生する
            video.muted = true;
            video.play();
        }, 3000);


        async function predictVideo() {
            if (video.paused) {
                return;
            }
            if (lastVideoTime !== video.currentTime) {
                lastVideoTime = video.currentTime;
                poseLandmarker.detectForVideo(video, (1000 * video.currentTime), (result) => {
                    // console.log("landmark : ", result.landmarks[0]);
                    landmarksList.push({ currentTime: video.currentTime, result: result });
                    canvasCtx.save();
                    canvasCtx.clearRect(0, 0, output_canvas.width, output_canvas.height);
                    for (const landmark of result.landmarks) {
                        drawingUtils.drawLandmarks(landmark, {
                            radius: (data) => DrawingUtils.lerp(data.from?.z ?? 0, -0.15, 0.1, 5, 1)
                        });
                        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
                    }
                    canvasCtx.restore();
                });
            }
            // video.durationの間だけrequestAnimationFrameでpredictVideo()を呼び出す
            if (video.currentTime <= video.duration) {
                window.requestAnimationFrame(predictVideo);
            }
        }


        setTimeout(() => {

            const landmarksListTrim = landmarksList.filter((landmark) => landmark.result.worldLandmarks[0] && landmark.result.worldLandmarks[0].length > 0);

            const frameSlider = document.getElementById("frameSlider");
            frameSlider.max = landmarksListTrim.length - 1;
            const frameSliderValue = document.getElementById("frameSliderValue");
            frameSliderValue.innerText = "[1/" + landmarksListTrim.length + "枚目] 0秒";


            const landmarkTable = document.getElementById("landmarkTable");
            console.log("landmarksList : ", landmarksList);

            frameSlider.addEventListener("input", (event) => {
                const result = landmarksListTrim[event.target.value];
                const index = parseInt(event.target.value);




                frameSliderValue.innerText = "[" + (index + 1) + "/" + landmarksListTrim.length + "枚目] " + result.currentTime + "秒";
                if (result) {
                    const frameCanvas = document.getElementById("frameCanvas");
                    const frameCanvasCtx = frameCanvas.getContext("2d");
                    frameCanvasCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
                    frameCanvas.width = video.videoWidth * 0.25;
                    frameCanvas.height = video.videoHeight * 0.25;
                    frameCanvas.style.display = "block";
                    frameCanvas.style.border = "1px solid black";
                    frameCanvas.style.backgroundColor = "#072300";
                    const drawingUtils = new DrawingUtils(frameCanvasCtx);
                    // drawingUtils.clear();
                    drawingUtils.drawLandmarks(result.result.landmarks[0], {
                        radius: (data) => DrawingUtils.lerp(data.from?.z ?? 0, -0.15, 0.1, 5, 1),
                        color: "white",
                        fillColor: "gray"
                    });
                    drawingUtils.drawConnectors(result.result.landmarks[0], PoseLandmarker.POSE_CONNECTIONS, {
                        color: "white"
                    });
                    frameCanvasCtx.restore();
                    //     <table id="landmarkTable">
                    //       <tr>
                    //       <th>部位 (Original) </th>
                    //       <th>X座標/写真左方向(cm)</th><th>Y座標/写真下方向(cm)</th><th>Z座標/写真手前方向(cm)</th>
                    //     </tr>
                    //   </table>
                    const positionNamesJP = [
                        "鼻 (nose)",
                        "左目-内側 (left eye - inner)",
                        "左目 (left eye)",
                        "左目-外側 (left eye - outer)",
                        "右目-内側 (right eye - inner)",
                        "右目 (right eye)",
                        "右目-外側 (right eye - outer)",
                        "左耳 (left ear)",
                        "右耳 (right ear)",
                        "口-左縁 (mouth - left)",
                        "口-右縁 (mouth - right)",
                        "左肩 (left shoulder)",
                        "右肩 (right shoulder)",
                        "左肘 (left elbow)",
                        "右肘 (right elbow)",
                        "左手首 (left wrist)",
                        "右手首 (right wrist)",
                        "左小指 (left pinky)",
                        "右小指 (right pinky)",
                        "左人差し指 (left index)",
                        "右人差し指 (right index)",
                        "左親指 (left thumb)",
                        "右親指 (right thumb)",
                        "左腰 (left hip)",
                        "右腰 (right hip)",
                        "左膝 (left knee)",
                        "右膝 (right knee)",
                        "左足首 (left ankle)",
                        "右足首 (right ankle)",
                        "左かかと (left heel)",
                        "右かかと (right heel)",
                        "左足先 (left foot index)",
                        "右足先 (right foot index)"
                    ];
                    landmarkTable.innerHTML = "";
                    const tr = document.createElement("tr");
                    const th1 = document.createElement("th");
                    th1.innerText = "部位 (Original)";
                    tr.appendChild(th1);
                    const th2 = document.createElement("th");
                    th2.innerText = "X座標/ 写真左方向(cm)";
                    tr.appendChild(th2);
                    const th3 = document.createElement("th");
                    th3.innerText = "Y座標/ 写真下方向(cm)";
                    tr.appendChild(th3);
                    const th4 = document.createElement("th");
                    th4.innerText = "Z座標/ 写真手前方向(cm)";
                    tr.appendChild(th4);
                    landmarkTable.appendChild(tr);
                    for (let i = 0; i < result.result.worldLandmarks[0].length; i++) {
                        const tr = document.createElement("tr");
                        const td1 = document.createElement("td");
                        td1.innerText = (i + 1) + ". " + positionNamesJP[i];
                        tr.appendChild(td1);
                        const td2 = document.createElement("td");
                        td2.innerText = Math.round(result.result.worldLandmarks[0][i].x * 1000) / 10;
                        tr.appendChild(td2);
                        const td3 = document.createElement("td");
                        td3.innerText = Math.round(result.result.worldLandmarks[0][i].y * 1000) / 10;
                        tr.appendChild(td3);
                        const td4 = document.createElement("td");
                        td4.innerText = Math.round(result.result.worldLandmarks[0][i].z * 1000) / 10;
                        tr.appendChild(td4);
                        landmarkTable.appendChild(tr);
                    }
                    const td_angle_12_14_16 = document.getElementById("angle_12_14_16");
                    const td_angle_11_13_15 = document.getElementById("angle_11_13_15");
                    const td_angle_24_26_28 = document.getElementById("angle_24_26_28");
                    const td_angle_23_25_27 = document.getElementById("angle_23_25_27");
                    // 1行にまとめる
                    td_angle_11_13_15.innerText = Math.round(180 * Math.acos(((result.result.worldLandmarks[0][11].x - result.result.worldLandmarks[0][13].x) * (result.result.worldLandmarks[0][15].x - result.result.worldLandmarks[0][13].x) + (result.result.worldLandmarks[0][11].y - result.result.worldLandmarks[0][13].y) * (result.result.worldLandmarks[0][15].y - result.result.worldLandmarks[0][13].y) + (result.result.worldLandmarks[0][11].z - result.result.worldLandmarks[0][13].z) * (result.result.worldLandmarks[0][15].z - result.result.worldLandmarks[0][13].z)) / (Math.sqrt((result.result.worldLandmarks[0][11].x - result.result.worldLandmarks[0][13].x) ** 2 + (result.result.worldLandmarks[0][11].y - result.result.worldLandmarks[0][13].y) ** 2 + (result.result.worldLandmarks[0][11].z - result.result.worldLandmarks[0][13].z) ** 2) * Math.sqrt((result.result.worldLandmarks[0][15].x - result.result.worldLandmarks[0][13].x) ** 2 + (result.result.worldLandmarks[0][15].y - result.result.worldLandmarks[0][13].y) ** 2 + (result.result.worldLandmarks[0][15].z - result.result.worldLandmarks[0][13].z) ** 2))) / Math.PI * 10) / 10;
                   td_angle_12_14_16.innerText = Math.round(180 * Math.acos(((result.result.worldLandmarks[0][12].x - result.result.worldLandmarks[0][14].x) * (result.result.worldLandmarks[0][16].x - result.result.worldLandmarks[0][14].x) + (result.result.worldLandmarks[0][12].y - result.result.worldLandmarks[0][14].y) * (result.result.worldLandmarks[0][16].y - result.result.worldLandmarks[0][14].y) + (result.result.worldLandmarks[0][12].z - result.result.worldLandmarks[0][14].z) * (result.result.worldLandmarks[0][16].z - result.result.worldLandmarks[0][14].z)) / (Math.sqrt((result.result.worldLandmarks[0][12].x - result.result.worldLandmarks[0][14].x) ** 2 + (result.result.worldLandmarks[0][12].y - result.result.worldLandmarks[0][14].y) ** 2 + (result.result.worldLandmarks[0][12].z - result.result.worldLandmarks[0][14].z) ** 2) * Math.sqrt((result.result.worldLandmarks[0][16].x - result.result.worldLandmarks[0][14].x) ** 2 + (result.result.worldLandmarks[0][16].y - result.result.worldLandmarks[0][14].y) ** 2 + (result.result.worldLandmarks[0][16].z - result.result.worldLandmarks[0][14].z) ** 2))) / Math.PI * 10) / 10;
                   td_angle_23_25_27.innerText = Math.round(180 * Math.acos(((result.result.worldLandmarks[0][23].x - result.result.worldLandmarks[0][25].x) * (result.result.worldLandmarks[0][27].x - result.result.worldLandmarks[0][25].x) + (result.result.worldLandmarks[0][23].y - result.result.worldLandmarks[0][25].y) * (result.result.worldLandmarks[0][27].y - result.result.worldLandmarks[0][25].y) + (result.result.worldLandmarks[0][23].z - result.result.worldLandmarks[0][25].z) * (result.result.worldLandmarks[0][27].z - result.result.worldLandmarks[0][25].z)) / (Math.sqrt((result.result.worldLandmarks[0][23].x - result.result.worldLandmarks[0][25].x) ** 2 + (result.result.worldLandmarks[0][23].y - result.result.worldLandmarks[0][25].y) ** 2 + (result.result.worldLandmarks[0][23].z - result.result.worldLandmarks[0][25].z) ** 2) * Math.sqrt((result.result.worldLandmarks[0][27].x - result.result.worldLandmarks[0][25].x) ** 2 + (result.result.worldLandmarks[0][27].y - result.result.worldLandmarks[0][25].y) ** 2 + (result.result.worldLandmarks[0][27].z - result.result.worldLandmarks[0][25].z) ** 2))) / Math.PI * 10) / 10;
                   td_angle_24_26_28.innerText = Math.round(180 * Math.acos(((result.result.worldLandmarks[0][24].x - result.result.worldLandmarks[0][26].x) * (result.result.worldLandmarks[0][28].x - result.result.worldLandmarks[0][26].x) + (result.result.worldLandmarks[0][24].y - result.result.worldLandmarks[0][26].y) * (result.result.worldLandmarks[0][28].y - result.result.worldLandmarks[0][26].y) + (result.result.worldLandmarks[0][24].z - result.result.worldLandmarks[0][26].z) * (result.result.worldLandmarks[0][28].z - result.result.worldLandmarks[0][26].z)) / (Math.sqrt((result.result.worldLandmarks[0][24].x - result.result.worldLandmarks[0][26].x) ** 2 + (result.result.worldLandmarks[0][24].y - result.result.worldLandmarks[0][26].y) ** 2 + (result.result.worldLandmarks[0][24].z - result.result.worldLandmarks[0][26].z) ** 2) * Math.sqrt((result.result.worldLandmarks[0][28].x - result.result.worldLandmarks[0][26].x) ** 2 + (result.result.worldLandmarks[0][28].y - result.result.worldLandmarks[0][26].y) ** 2 + (result.result.worldLandmarks[0][28].z - result.result.worldLandmarks[0][26].z) ** 2))) / Math.PI * 10) / 10;
                    console.log("Finished updating landmarkTable");
                }

            })
            console.log("start Google Charts API");
            //   landmarksListでundefinedがあるとエラーが出るので、landmarksListで要素がある部分だけを抽出する

            google.charts.load('current', { 'packages': ['corechart'] });
            google.charts.setOnLoadCallback(drawChart);

            function drawChart() {
                //   var data = google.visualization.arrayToDataTable([
                //     ['Age', 'Weight'],
                //     [ 8,      12],
                //     [ 4,      5.5],
                //     [ 11,     14],
                //     [ 4,      5],
                //     [ 3,      3.5],
                //     [ 6.5,    7]
                //   ]);
                const landmarksListTrim2 = landmarksList.filter((landmark) => landmark.result.worldLandmarks[0] && landmark.result.worldLandmarks[0].length > 32);
                console.log("Start drawing Chart 2");
                var data2 = new google.visualization.arrayToDataTable([['time(秒)', '鼻の高さ', '右手首の高さ', '右肩の高さ', '右足首の高さ'], ...landmarksListTrim2.map((landmark, index) => [landmark.currentTime, -100 * landmark.result.worldLandmarks[0][0].y, -100 * landmark.result.worldLandmarks[0][15].y, -100 * landmark.result.worldLandmarks[0][13].y, -100 * landmark.result.worldLandmarks[0][29].y])]);
                var options2 = {
                    title: '鼻・右手首・右肩・右足首の高さの推移(worldLandmark:腰の高さを0cmとした実世界の推定高度)',
                    hAxis: { title: 'time(秒)', minValue: 0, maxValue: video.duration },
                    vAxis: { title: '高さ(cm)' },
                    lineWidth: 1,
                    pointSize: 2,
                    pointShape: 'circle',
                    legend: { position: 'top' },
                    series: [
                        { color: '#FF0000', labelInLegend: '鼻の高さ' },
                        { color: '#00FF00', labelInLegend: '右手首の高さ' },
                        { color: '#0000FF', labelInLegend: '右肩の高さ' },
                        { color: '#FFFF00', labelInLegend: '右足首の高さ' }
                    ]
                };
                var chart2 = new google.visualization.ScatterChart(document.getElementById('chart_div2'));
                chart2.draw(data2, options2);
                console.log("Finished drawing Chart 2");

                console.log("Start drawing Chart 3");
                var data3 = new google.visualization.arrayToDataTable([['time(秒)', '鼻の高さ', '左手首の高さ', '左肩の高さ', '左足首の高さ'], ...landmarksListTrim2.map((landmark, index) => [landmark.currentTime, -100 * landmark.result.worldLandmarks[0][0].y, -100 * landmark.result.worldLandmarks[0][16].y, -100 * landmark.result.worldLandmarks[0][14].y, -100 * landmark.result.worldLandmarks[0][30].y])]);
                var options3 = {
                    title: '鼻・左手首・左肩・左足首の高さの推移(実世界の推定高度)',
                    hAxis: { title: 'time(秒)', minValue: 0, maxValue: video.duration },
                    vAxis: { title: '高さ(cm)' },
                    lineWidth: 1,
                    pointSize: 2,
                    pointShape: 'circle',
                    legend: { position: 'top' },
                    series: [
                        { color: '#FF0000', labelInLegend: '鼻の高さ' },
                        { color: '#00FF00', labelInLegend: '左手首の高さ' },
                        { color: '#0000FF', labelInLegend: '左肩の高さ' },
                        { color: '#FFFF00', labelInLegend: '左足首の高さ' }
                    ]
                };
                var chart3 = new google.visualization.ScatterChart(document.getElementById('chart_div3'));
                chart3.draw(data3, options3);
                console.log("start drawing Chart 4");
                const angleList = landmarksListTrim.map((landmark, index) => {
                    if(!landmark.result || !landmark.result.worldLandmarks || !landmark.result.worldLandmarks[0] || landmark.result.worldLandmarks[0].length < 33){
                        return;
                    }
                    const angle_11_13_15 = Math.round(180 * Math.acos(((landmark.result.worldLandmarks[0][11].x - landmark.result.worldLandmarks[0][13].x) * (landmark.result.worldLandmarks[0][15].x - landmark.result.worldLandmarks[0][13].x) + (landmark.result.worldLandmarks[0][11].y - landmark.result.worldLandmarks[0][13].y) * (landmark.result.worldLandmarks[0][15].y - landmark.result.worldLandmarks[0][13].y) + (landmark.result.worldLandmarks[0][11].z - landmark.result.worldLandmarks[0][13].z) * (landmark.result.worldLandmarks[0][15].z - landmark.result.worldLandmarks[0][13].z)) / (Math.sqrt((landmark.result.worldLandmarks[0][11].x - landmark.result.worldLandmarks[0][13].x) ** 2 + (landmark.result.worldLandmarks[0][11].y - landmark.result.worldLandmarks[0][13].y) ** 2 + (landmark.result.worldLandmarks[0][11].z - landmark.result.worldLandmarks[0][13].z) ** 2) * Math.sqrt((landmark.result.worldLandmarks[0][15].x - landmark.result.worldLandmarks[0][13].x) ** 2 + (landmark.result.worldLandmarks[0][15].y - landmark.result.worldLandmarks[0][13].y) ** 2 + (landmark.result.worldLandmarks[0][15].z - landmark.result.worldLandmarks[0][13].z) ** 2))) / Math.PI * 10) / 10;
                    const angle_12_14_16 = Math.round(180 * Math.acos(((landmark.result.worldLandmarks[0][12].x - landmark.result.worldLandmarks[0][14].x) * (landmark.result.worldLandmarks[0][16].x - landmark.result.worldLandmarks[0][14].x) + (landmark.result.worldLandmarks[0][12].y - landmark.result.worldLandmarks[0][14].y) * (landmark.result.worldLandmarks[0][16].y - landmark.result.worldLandmarks[0][14].y) + (landmark.result.worldLandmarks[0][12].z - landmark.result.worldLandmarks[0][14].z) * (landmark.result.worldLandmarks[0][16].z - landmark.result.worldLandmarks[0][14].z)) / (Math.sqrt((landmark.result.worldLandmarks[0][12].x - landmark.result.worldLandmarks[0][14].x) ** 2 + (landmark.result.worldLandmarks[0][12].y - landmark.result.worldLandmarks[0][14].y) ** 2 + (landmark.result.worldLandmarks[0][12].z - landmark.result.worldLandmarks[0][14].z) ** 2) * Math.sqrt((landmark.result.worldLandmarks[0][16].x - landmark.result.worldLandmarks[0][14].x) ** 2 + (landmark.result.worldLandmarks[0][16].y - landmark.result.worldLandmarks[0][14].y) ** 2 + (landmark.result.worldLandmarks[0][16].z - landmark.result.worldLandmarks[0][14].z) ** 2))) / Math.PI * 10) / 10;
                    const angle_23_25_27 = Math.round(180 * Math.acos(((landmark.result.worldLandmarks[0][23].x - landmark.result.worldLandmarks[0][25].x) * (landmark.result.worldLandmarks[0][27].x - landmark.result.worldLandmarks[0][25].x) + (landmark.result.worldLandmarks[0][23].y - landmark.result.worldLandmarks[0][25].y) * (landmark.result.worldLandmarks[0][27].y - landmark.result.worldLandmarks[0][25].y) + (landmark.result.worldLandmarks[0][23].z - landmark.result.worldLandmarks[0][25].z) * (landmark.result.worldLandmarks[0][27].z - landmark.result.worldLandmarks[0][25].z)) / (Math.sqrt((landmark.result.worldLandmarks[0][23].x - landmark.result.worldLandmarks[0][25].x) ** 2 + (landmark.result.worldLandmarks[0][23].y - landmark.result.worldLandmarks[0][25].y) ** 2 + (landmark.result.worldLandmarks[0][23].z - landmark.result.worldLandmarks[0][25].z) ** 2) * Math.sqrt((landmark.result.worldLandmarks[0][27].x - landmark.result.worldLandmarks[0][25].x) ** 2 + (landmark.result.worldLandmarks[0][27].y - landmark.result.worldLandmarks[0][25].y) ** 2 + (landmark.result.worldLandmarks[0][27].z - landmark.result.worldLandmarks[0][25].z) ** 2))) / Math.PI * 10) / 10;
                    const angle_24_26_28 = Math.round(180 * Math.acos(((landmark.result.worldLandmarks[0][24].x - landmark.result.worldLandmarks[0][26].x) * (landmark.result.worldLandmarks[0][28].x - landmark.result.worldLandmarks[0][26].x) + (landmark.result.worldLandmarks[0][24].y - landmark.result.worldLandmarks[0][26].y) * (landmark.result.worldLandmarks[0][28].y - landmark.result.worldLandmarks[0][26].y) + (landmark.result.worldLandmarks[0][24].z - landmark.result.worldLandmarks[0][26].z) * (landmark.result.worldLandmarks[0][28].z - landmark.result.worldLandmarks[0][26].z)) / (Math.sqrt((landmark.result.worldLandmarks[0][24].x - landmark.result.worldLandmarks[0][26].x) ** 2 + (landmark.result.worldLandmarks[0][24].y - landmark.result.worldLandmarks[0][26].y) ** 2 + (landmark.result.worldLandmarks[0][24].z - landmark.result.worldLandmarks[0][26].z) ** 2) * Math.sqrt((landmark.result.worldLandmarks[0][28].x - landmark.result.worldLandmarks[0][26].x) ** 2 + (landmark.result.worldLandmarks[0][28].y - landmark.result.worldLandmarks[0][26].y) ** 2 + (landmark.result.worldLandmarks[0][28].z - landmark.result.worldLandmarks[0][26].z) ** 2))) / Math.PI * 10) / 10;
                    return [landmark.currentTime, angle_11_13_15, angle_12_14_16, angle_23_25_27, angle_24_26_28];
                });
                console.log("angleList : ", angleList);
                var data4 = new google.visualization.arrayToDataTable([['time(秒)', '左肘のなす角度', '右肘のなす角度', '左膝のなす角度', '右膝のなす角度'], ...angleList]);
                var options4 = {
                    title: '肘・肩・膝のなす角度の推移',
                    hAxis: { title: 'time(秒)', minValue: 0, maxValue: video.duration },
                    vAxis: { title: '角度(°)' ,minValue: 0, maxValue: 180},
                    lineWidth: 1,
                    pointSize: 2,
                    pointShape: 'circle',
                    legend: { position: 'top' },
                    series: [
                        { color: '#FF0000', labelInLegend: '左肘のなす角度' },
                        { color: '#00FF00', labelInLegend: '右肘のなす角度' },
                        { color: '#0000FF', labelInLegend: '左膝のなす角度' },
                        { color: '#FFFF00', labelInLegend: '右膝のなす角度' }
                    ]
                };
                var chart4 = new google.visualization.ScatterChart(document.getElementById('chart_div4'));
                chart4.draw(data4, options4);
                console.log("Finished drawing Chart 4");

            }
        }, video.duration * 1000 + 5000);










        // 動画を0.5秒ごとにキャプチャして表示
        //         const frameInterval = 0.5;
        //         let frameNumber = -1;
        //         const frameIntervalCapture = setInterval(async () => {
        //             frameNumber++;
        //             getFrame(frameNumber);
        //             if (video.currentTime + 2 * frameInterval > video.duration) {
        //                 // 動画の再生が終了したらframeIntervalCaptureを停止
        //                 clearInterval(frameIntervalCapture);
        //             }
        //         }, frameInterval * 1000);

        //         // setTimeoutでposeLandmarker.detectを呼び出す
        //         setTimeout(async () => {
        //             if (!poseLandmarker) {
        //                 console.log("poseLandmarker is not ready yet.");
        //                 return;
        //             }
        //             if (runningMode == "VIDEO") {
        //                 runningMode = "IMAGE";
        //                 poseLandmarker.setOptions({ runningMode: "IMAGE" });
        //             }
        //             console.log("ready to process video");
        //             const frameImageWrapper = document.getElementById("frameImageWrapper");
        //             console.log("frameImageWrapper.childElementCount : ");
        //             console.log(frameImageWrapper.childElementCount);
        //             console.log(frameImageWrapper.children);
        //             // 1秒ごとにposeLandmarker.detectを呼び出す
        //             let i = -1;
        //             const frameIntervalDetect = setInterval(async () => {
        //                 if (i >= frameImageWrapper.childElementCount) {
        //                     clearInterval(frameIntervalDetect);
        //                 }
        //                 // if (frameImageWrapper.children[i] == undefined) {
        //                 //     clearInterval(frameIntervalDetect);
        //                 // }
        //                 i++;
        //                 const image = frameImageWrapper.children[i];
        //                 const poseCanvas = document.createElement("canvas");
        //                 poseCanvas.setAttribute("class", "canvas");
        //                 poseCanvas.setAttribute("width", image.style.width);
        //                 poseCanvas.setAttribute("height", image.style.height);
        //                 poseCanvas.style.left = image.offsetLeft + "px";
        //                 poseCanvas.style.top = image.offsetTop + "px";
        //                 frameImageWrapper.appendChild(poseCanvas);
        //                 console.log("created image and canvas : " + image.id);
        //                 await poseLandmarker.detect(image, async (result) => {
        //                     const poseCanvasCtx = poseCanvas.getContext("2d");
        //                     const drawingUtils = new DrawingUtils(poseCanvasCtx);
        //                     for (const landmark of result.landmarks) {
        //                         drawingUtils.drawLandmarks(landmark, {
        //                             radius: (data) => DrawingUtils.lerp(data.from?.z ?? 0, -0.15, 0.1, 5, 1)
        //                         });
        //                         drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
        //                     }
        //                 })
        //                 console.log("finished processing video frame : " + image.id);
        //             }, 1500);

        //             // const image0 = frameImageWrapper.children[0];
        //             // const poseCanvas0 = document.createElement("canvas");
        //             // poseCanvas0.setAttribute("class", "canvas");
        //             // poseCanvas0.setAttribute("width", image0.style.width);
        //             // poseCanvas0.setAttribute("height", image0.style.height);
        //             // poseCanvas0.style.left = image0.offsetLeft + "px";
        //             // poseCanvas0.style.top = image0.offsetTop + "px";
        //             // frameImageWrapper.appendChild(poseCanvas0);
        //             // console.log("created image and canvas : " + image0.id);
        //             // await poseLandmarker.detect(image0, async (result) => {
        //             //     const poseCanvasCtx = poseCanvas0.getContext("2d");
        //             //     const drawingUtils = new DrawingUtils(poseCanvasCtx);
        //             //     for (const landmark of result.landmarks) {
        //             //         drawingUtils.drawLandmarks(landmark, {
        //             //             radius: (data) => DrawingUtils.lerp(data.from?.z ?? 0, -0.15, 0.1, 5, 1)
        //             //         });
        //             //         drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
        //             //     }
        //             // })
        //             // console.log("finished processing video frame : " + image0.id);

        //             console.log("finished processing video");
        //         }, video.duration * 1000 + 2000);



        //         function getFrame(num) {
        //             const canvas = document.createElement("canvas");
        //             const ctx = canvas.getContext("2d");
        //             ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        //             const image = document.createElement("img")
        //             image.id = "videoFrame" + num;
        //             image.style.width = "50px";
        //             image.style.height = "50px";
        //             image.style.margin = "2px";
        //             image.crossOrigin = "anonymous"
        //             image.loading = "lazy"
        //             image.src = canvas.toDataURL();
        //             const videoFrameWrapper = document.getElementById("videoFrameWrapper");
        //             videoFrameWrapper.appendChild(image);
        //             const image2 = document.createElement("img")
        //             image2.id = "frameImage" + num;
        //             image2.style.width = (0.25*video.videoWidth) + "px";
        //             image2.style.height = (0.25*video.videoHeight) + "px";
        //             image2.style.margin = "2px";
        //             image2.crossOrigin = "anonymous"
        //             image2.loading = "lazy"
        //             image2.src = canvas.toDataURL();
        //             const frameImageWrapper = document.getElementById("frameImageWrapper");
        //             frameImageWrapper.appendChild(image2);
        //         }



    });

});



