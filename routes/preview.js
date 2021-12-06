const express = require('express');
const router = express.Router();
var multer = require('multer');
const fs = require('fs');
const path = require('path');

const { Preview } = require("../models/Preview");

var storage = multer.diskStorage({
    // ファイルの保存先を指定
    destination: function (req, file, cb) {
      cb(null, './uploads/')
    },
    // ファイル名を指定(オリジナルのファイル名を指定)
    filename: function (req, file, cb) {
      cb(null, file.originalname)
    }
})

var upload = multer({ storage: storage })




router.get("/hello", (req, res) => {
    return res.status(200).json({ result: "hello"});
})


router.post("/uploadfiles", upload.single("file"), (req, res) => {

    // create root directory path
    let root = __dirname

    var splitArr = root.split("/");
    var newSplitArr = []
    for (var i=0; i<splitArr.length-1; i++){
        newSplitArr.push(splitArr[i])
    }

    root = newSplitArr.join("/");

    // copy file
    fs.copyFile(`${root}/uploads/${req.file.filename}`, `${root}/public/uploads/${req.file.filename}`, (err) => {
        console.log(err);
    });

    fs.unlinkSync(`${root}/uploads/${req.file.filename}`);

    

    let vrmurl = `http://localhost:3000/uploads/${req.file.filename}`
    let username = req.file.filename.split(".")[0];
    let ext = req.file.filename.split(".")[1];

    let variables = {
        url: vrmurl,
        username: username,
    }

    const preview = new Preview(variables);

    Preview.find({"url": vrmurl, "username": username})
    .exec((err, result) => {
        if (err) return res.status(400).json({ success: false, err });
        console.log(result);
        if (result.length === 0){
            if (ext === "vrm"){
                preview.save((err, pre) => {
                    console.log(err, pre);
                    if(err) return res.status(400).json({ success: false, err })
                    return res.status(200).json({
                        success: true ,
                        url: vrmurl,
                        username: username,
                    })
                })
            }

        }
    })

});

router.post("/getvrm", (req, res) => {

    Preview.find({ "username" : req.body.username })
    .exec((err, result) => {
        if (err) return res.status(400).json({ success: false, err });
        return res.status(200).json({ success: true, result });
    })
})

module.exports = router;