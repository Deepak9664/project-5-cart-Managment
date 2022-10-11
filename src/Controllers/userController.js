const User = require("../Models/userModel");
const validate = require("../Utility/validator");
const bcrypt = require("bcrypt");
const aws = require("../MIddleware/aws");
const jwt = require("jsonwebtoken");

const createUser = async function (req, res) {
	try {
		const data = req.body;
		const imageFile = req.files;

		if (validate.isEmptyObject(data))
			return res
				.status(400)
				.send({ status: false, message: "Please provide user details" });

		if (imageFile.length<1)
			return res
				.status(400)
				.send({ status: false, message: "Please provide profileImage" });

		const fileTypes = ["image/png", "image/jpeg"];
		if (validate.acceptFileType(imageFile, fileTypes))
			return res.status(400).send({
				status: false,
				message: `Invalid profileImage type. Please upload a jpg, jpeg or png file.`,
			});

		const imageUrl = await aws.uploadFile(imageFile[0]);
		data.profileImage = imageUrl;

		const mandatoryFields = ["fname", "lname", "email", "phone", "password"];

		for (field of mandatoryFields) {
			if (!data[field])
				return res
					.status(400)
					.send({ status: false, message: `Please provide ${field}` });
		}

		data.address = JSON.parse(data.address);
		if (
			typeof data.address !== "object" ||
			typeof data.address.shipping !== "object" ||
			typeof data.address.billing !== "object"
		) {
			return res
				.status(400)
				.send({ status: false, message: "address should be an object" });
		}

		const mandatoryAddressFields = ["street", "city", "pincode"];

		for (field of mandatoryAddressFields) {
			if (!data.address.shipping[field])
				return res
					.status(400)
					.send({ status: false, message: `Please provide ${field}` });
		}

		for (field of mandatoryAddressFields) {
			if (!data.address.billing[field])
				return res
					.status(400)
					.send({ status: false, message: `Please provide ${field}` });
		}

		for (field of mandatoryFields) {
			if (validate.isValidString(data[field]))
				return res
					.status(400)
					.send({ status: false, message: `Please provide a valid ${field}` });
		}

		const stringAddressFields = ["street", "city"];
		for (field of stringAddressFields) {
			if (validate.isValidString(data.address.shipping[field]))
				return res.status(400).send({
					status: false,
					message: `Please provide a valid shipping ${field}`,
				});
		}

		for (field of stringAddressFields) {
			if (validate.isValidString(data.address.billing[field]))
				return res.status(400).send({
					status: false,
					message: `Please provide a valid billing ${field}`,
				});
		}

		if (
			typeof data.address.shipping.pincode !== "number" &&
			!validate.isPincodeValid(data.shipping.pincode.trim())
		)
			return res
				.status(400)
				.send({ status: false, message: "Invalid shipping pincode" });

		if (
			typeof data.address.billing.pincode !== "number" &&
			!validate.isPincodeValid(data.billing.pincode.trim())
		)
			return res
				.status(400)
				.send({ status: false, message: "Invalid billing pincode" });

		if (!validate.isValidPhone(data.phone))
			return res
				.status(400)
				.send({ status: false, message: "Invalid phone number" });

		if (!validate.isValidEmail(data.email))
			return res.status(400).send({ status: false, message: "Invalid email" });

		if (data.password.trim().length < 15 && data.password.trim().length > 8) {
			if (!validate.isValidPassword(data.password))
				return res.status(400).send({
					status: false,
					message:
						"Password must contain special characters, numbers, uppercase and lowercase",
				});
		} else {
			return res.status(400).send({
				status: false,
				message: "Password length should be between 8 to 15 characters",
			});
		}

		const uniqueFields = ["email", "phone"];
		for (field of uniqueFields) {
			let empObj = {};
			empObj[field] = data[field];
			const isPresent = await User.findOne(empObj);
			if (isPresent)
				return res
					.status(400)
					.send({ status: false, message: `${field} already present` });
		}

		data.password = await bcrypt.hash(data.password, 10);

		const userData = await User.create(data);
		res.status(201).send({
			status: true,
			message: "User created successfully",
			data: userData,
		});
	} catch (error) {
		res.status(500).send(error.message);
	}
};

const userLogin = async function (req, res) {
	try {
		let body = req.body;
		const { email, password } = body;

		if (validate.isEmptyObject(body)) {
			return res
				.status(400)
				.send({ status: false, message: "Data is required to login" });
		}

		if (validate.isEmptyVar(email))
			return res
				.status(400)
				.send({ status: false, message: "EmailId is mandatory" });

		if (!validate.isValidEmail(email)) {
			return res
				.status(400)
				.send({ status: false, message: "Email must be valid" });
		}

		if (validate.isEmptyVar(password))
			return res
				.status(400)
				.send({ status: false, message: "Password is mandatory" });

		if (!validate.isValidPassword) {
			return res.status(400).send({
				status: false,
				message: `Password length should be A Valid Password And Length Should Be in between 8 to 15 `,
			});
		}

		let user = await User.findOne({ email: email });
		if (!user) {
			return res
				.status(400)
				.send({ status: false, msg: "Invalid credentials or user not exist" });
		}

		let bcryptpassword = await bcrypt.compare(password, user.password);
		if (!bcryptpassword)
			return res
				.status(401)
				.send({ status: false, message: "Incorrect password" });

		const token = jwt.sign(
			{
				userId: user._id,

				expiresIn: "1h",
			},
			"Group-10 secret key"
		);
		return res.status(200).send({
			status: true,
			message: "User login successfull",
			data: { userId: user._id, token: token },
		});
	} catch (error) {
		res.status(500).send({ status: false, message: error.message });
	}
};

// -------------------------------------------- PUT /user/:userId/profile --------------------------------------------

const updateUser = async (req, res) => {
	try {
		let userId = req.params.userId;
		let data = req.body;
		let files = req.files;

		let { fname, lname, email, password, phone } = data;

		//getting the AWS-S3 link after uploading the user's profileImage
		if (files && files.length != 0) {
			let profileImgUrl = await aws.uploadFile(files[0]);
			data.profileImage = profileImgUrl;
		}

		//validating the request body
		if (!validate.isValidInputBody(data))
			return res.status(400).send({
				status: false,
				message: "Enter details to update your account data",
			});

		if (typeof fname == "string") {
			//checking for firstname
			if (!validate.isValid(fname))
				return res.status(400).send({
					status: false,
					message: "First name should not be an empty string",
				});

			//validating firstname
			if (validate.isValidString(fname))
				return res.status(400).send({
					status: false,
					message: "Enter a valid First name and should not contains numbers",
				});
		}

		if (typeof lname == "string") {
			//checking for lastname
			if (validate.isValid(lname))
				return res.status(400).send({
					status: false,
					message: "Last name should not be an empty string",
				});

			//validating lastname
			if (validate.isValidString(lname))
				return res.status(400).send({
					status: false,
					message: "Enter a valid Last name and should not contains numbers",
				});
		}

		//validating user email-id
		if (data.email && !validate.isValidEmail(email))
			return res
				.status(400)
				.send({ status: false, message: "Please Enter a valid Email-id" });

		//checking if email already exist or not
		let duplicateEmail = await User.findOne({ email: email });
		if (duplicateEmail)
			return res
				.status(400)
				.send({ status: false, message: "Email already exist" });

		//validating user phone number
		if (data.phone && !validate.isValidPhone(phone))
			return res
				.status(400)
				.send({ status: false, message: "Please Enter a valid Phone number" });

		//checking if email already exist or not
		let duplicatePhone = await User.findOne({ phone: phone });
		if (duplicatePhone)
			return res
				.status(400)
				.send({ status: false, message: "Phone already exist" });

		if (data.password || typeof password == "string") {
			//validating user password
			if (!validate.isValidPwd(password))
				return res.status(400).send({
					status: false,
					message: "Password should be between 8 and 15 character",
				});

			//hashing password with bcrypt
			data.password = await bcrypt.hash(password, 10);
		}

		if (data.address === "") {
			return res
				.status(400)
				.send({ status: false, message: "Please enter a valid address" });
		} else if (data.address) {
			if (validate.isValid(data.address)) {
				return res
					.status(400)
					.send({ status: false, message: "Please provide address field" });
			}
			data.address = JSON.parse(data.address);

			if (typeof data.address !== "object") {
				return res
					.status(400)
					.send({ status: false, message: "address should be an object" });
			}
			let { shipping, billing } = data.address;

			if (shipping) {
				if (typeof shipping != "object") {
					return res
						.status(400)
						.send({ status: false, message: "shipping should be an object" });
				}

				if (validate.isValid(shipping.street)) {
					return res
						.status(400)
						.send({ status: false, message: "shipping street is required" });
				}

				if (validate.isValid(shipping.city)) {
					return res
						.status(400)
						.send({ status: false, message: "shipping city is required" });
				}

				if (!validate.isvalidCity(shipping.city)) {
					return res.status(400).send({
						status: false,
						message: "city field have to fill by alpha characters",
					});
				}

				if (validate.isValid(shipping.pincode)) {
					return res
						.status(400)
						.send({ status: false, message: "shipping pincode is required" });
				}

				if (!validate.isValidPincode(shipping.pincode)) {
					return res
						.status(400)
						.send({ status: false, message: "please enter valid pincode" });
				}
			} else {
				return res
					.status(400)
					.send({ status: false, message: "please enter shipping address" });
			}

			if (billing) {
				if (typeof billing != "object") {
					return res
						.status(400)
						.send({ status: false, message: "billing should be an object" });
				}

				if (validate.isValid(billing.street)) {
					return res
						.status(400)
						.send({ status: false, message: "billing street is required" });
				}

				if (validate.isValid(billing.city)) {
					return res
						.status(400)
						.send({ status: false, message: "billing city is required" });
				}
				if (!validate.isvalidCity(billing.city)) {
					return res.status(400).send({
						status: false,
						message: "city field have to fill by alpha characters",
					});
				}

				if (validate.isValid(billing.pincode)) {
					return res
						.status(400)
						.send({ status: false, message: "billing pincode is required" });
				}

				if (!validate.isValidPincode(billing.pincode)) {
					return res.status(400).send({
						status: false,
						message: "please enter valid billing pincode",
					});
				}
			} else {
				return res
					.status(400)
					.send({ status: false, message: "please enter billing address" });
			}
		}

		let updatedUser = await User.findOneAndUpdate({ _id: userId }, data, {
			new: true,
		});
		return res.status(200).send({
			status: true,
			message: "User profile updated",
			data: updatedUser,
		});
	} catch (error) {
		return res.status(500).send({ status: false, message: error.message });
	}
};

module.exports = { createUser, userLogin, updateUser };
