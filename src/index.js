const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const route = require("./routes/route");
const app = express();

app.use(bodyParser.json());
app.use(
	bodyParser.urlencoded({
		extended: true,
	})
);
app.use(multer().any());

mongoose
	.connect(
		"mongodb+srv://project5group10:9y46YnehOwJOJ4al@cluster0.xxbyiwq.mongodb.net/test",
		{ useNewUrlParser: true }
	)

	.then(() => console.log("✅ MongoDb is connected"))
	.catch((err) => console.log("⚠️ ", err));

app.use("/", route);

app.listen(3000, () => {
	console.log(`Express app connected to port 3000`);
});
