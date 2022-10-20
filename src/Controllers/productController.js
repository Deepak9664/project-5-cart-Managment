const Product = require("../Models/productModel");
const validate = require("../Utility/validator");
const aws = require("../MIddleware/aws");
const reg = new RegExp("^[0-9]+$");

const createProduct = async (req, res) => {
	try {
		const productData = req.body;
		const productImage = req.files;

		if (!validate.isValidInputBody(productData))
			return res
				.status(400)
				.send({ status: false, message: "Please provide product details" });

		if (productImage.length === 0)
			return res
				.status(400)
				.send({ status: false, message: "Please provide productImage" });

		const fileTypes = ["image/png", "image/jpeg", "image/jpg"];
		if (validate.acceptFileType(productImage, fileTypes))
			return res.status(400).send({
				status: false,
				message: `Invalid profileImage type. Please upload a jpg, jpeg or png file.`,
			});

		const mandatoryFields = ["title", "description", "availableSizes"];
		for (field of mandatoryFields) {
			if (!productData[field])
				return res
					.status(400)
					.send({ status: false, message: `Please provide ${field}` });
			if (!validate.isValid(productData[field]))
				return res
					.status(400)
					.send({ status: false, message: `Please provide a valid ${field}` });
		}

		if (!productData.price || productData.price.trim().length === 0) {
			return res
				.status(400)
				.send({ status: false, message: "Please provide product price" });
		} else if (!reg.test(productData.price)) {
			return res
				.status(400)
				.send({ status: false, message: "Invalid price input" });
		} else {
			productData.price = Number(productData.price);
		}

		if (
			!validate.isValidJSONstr(productData.availableSizes) ||
			typeof JSON.parse(productData.availableSizes) !== "object"
		)
			return res.status(400).send({
				status: false,
				message:
					"Please provide available sizes in an array and a JSON parseable format",
			});

		let availableSizes = JSON.parse(productData.availableSizes).map((x) =>
			x.toUpperCase()
		);
		const productEnumSizes = ["S", "XS", "M", "X", "L", "XXL", "XL"];
		for (sizes of availableSizes) {
			if (!productEnumSizes.includes(sizes))
				return res.status(400).send({
					status: false,
					message: `availableSizes can be only among these: ${productEnumSizes.join(
						", "
					)}`,
				});
		}
		productData.availableSizes = [...new Set(availableSizes)];

		if (productData.currencyId) {
			if (!validate.isValid(productData.currencyId))
				return res.status(400).send({
					status: false,
					message: `Please provide a valid currencyId`,
				});
			if (productData.currencyId != "INR" && productData.currencyId != "inr")
				return res.status(400).send({
					status: false,
					message: "currencyId should be INR",
				});
			productData.currencyId = "INR";
		}

		if (productData.currencyFormat) {
			if (!validate.isValid(productData.currencyFormat))
				return res.status(400).send({
					status: false,
					message: `Please provide a valid currencyFormat`,
				});
			if (productData.currencyFormat != "₹")
				return res.status(400).send({
					status: false,
					message: "currencyFormat should be ₹",
				});
		}

		if (productData.installments) {
			if (
				!reg.test(productData.installments) ||
				productData.installments.trim().length === 0
			)
				return res
					.status(400)
					.send({ status: false, message: "Installments should be a number" });
			else productData.installments = Number(productData.installments);
		}

		if (productData.isFreeShipping) {
			if (
				productData.isFreeShipping != "true" &&
				productData.isFreeShipping != "false"
			)
				return res.status(400).send({
					status: false,
					message: "Please give a true or false value for isFreeShipping",
				});
			if (productData.isFreeShipping == "true")
				productData.isFreeShipping = true;
		}

		const isUniqueTitle = await Product.findOne({ title: productData.title });
		if (isUniqueTitle)
			return res
				.status(400)
				.send({ status: false, message: "Title already present" });

		productData.productImage = await aws.uploadFile(productImage[0]);

		const createProduct = await Product.create(productData);
		res.status(201).send({
			status: true,
			message: "Product registered successfully",
			data: createProduct,
		});
	} catch (error) {
		res.status(500).send({ status: false, message: error.message });
	}
};

const getProduct = async (req, res) => {
	try {
		const userQuery = req.query;

		let { size, name, priceGreaterThan, priceLessThan, priceSort } = userQuery;

		//if no filter is provided
		if (Object.keys(userQuery).length == 0) {
			const product = await Product.find({ isDeleted: false }).sort({
				price: priceSort,
			});
			if (product.length === 0)
				return res.status(404).send({ status: false, msg: "No product found" });
			return res.status(200).send({
				status: true,
				message: `${product.length} product(s) found`,
				data: product,
			});
		}

		const queryFields = Object.keys(userQuery);
		for (field of queryFields) {
			if (!userQuery[field])
				return res
					.status(400)
					.send({ status: false, message: `Please provide ${field}` });
			if (!validate.isValid(userQuery[field]))
				return res
					.status(400)
					.send({ status: false, message: `Please provide a valid ${field}` });
		}

		userQuery.isDeleted = false;

		if (size) {
			if (
				!validate.isValidJSONstr(size) ||
				typeof JSON.parse(userQuery.size) !== "object" ||
				JSON.parse(userQuery.size).length < 1
			)
				return res.status(400).send({
					status: false,
					message: "Please provide sizes in an array",
				});

			let availableSizes = JSON.parse(userQuery.size).map((x) =>
				x.toUpperCase()
			);

			const productEnumSizes = ["S", "XS", "M", "X", "L", "XXL", "XL"];
			for (sizes of availableSizes) {
				if (!productEnumSizes.includes(sizes))
					return res.status(400).send({
						status: false,
						message: `availableSizes can be only among these: ${productEnumSizes.join(
							", "
						)}`,
					});
			}
			userQuery.availableSizes = { $in: [...availableSizes] };
			delete userQuery.size;
		}

		if (name) {
			name = new RegExp(name, "i");
			console.log(name);
			userQuery["title"] = { $regex: name };
		}

		if (priceGreaterThan) {
			if (!reg.test(Number(priceGreaterThan))) {
				return res
					.status(400)
					.send({ status: false, message: "Not a valid priceGreaterThan" });
			}
			userQuery["price"] = { $gt: Number(priceGreaterThan) };
			delete userQuery.priceGreaterThan;
		}
		if (priceLessThan) {
			if (!reg.test(Number(priceLessThan))) {
				return res
					.status(400)
					.send({ status: false, message: "Not a valid priceLessThan" });
			}
			userQuery["price"] = { $lt: Number(priceLessThan) };
			delete userQuery.priceLessThan;
		}

		if (priceGreaterThan && priceLessThan) {
			userQuery["price"] = {
				$gt: Number(priceGreaterThan),
				$lt: Number(priceLessThan),
			};
			delete userQuery.priceGreaterThan;
			delete userQuery.priceLessThan;
		}

		if (priceSort) {
			if (!(priceSort == 1 || priceSort == -1))
				return res.status(400).send({
					status: false,
					message: "Price sort value should be 1 or -1 only",
				});
		}

		let product = await Product.find(userQuery).sort({
			price: Number(priceSort),
		});

		if (product.length === 0)
			return res
				.status(404)
				.send({ status: false, message: "No products found" });
		return res.status(200).send({
			status: true,
			message: `${product.length} product(s) found`,
			data: product,
		});
	} catch (error) {
		return res.status(500).send({ status: false, message: error.message });
	}
};

const getProductById = async (req, res) => {
	try {
		if (!validate.isValidObjectId(req.params.productId)) {
			return res
				.status(400)
				.send({ status: false, message: "Please enter valid product id" });
		}
		let totalProducts = await Product.findOne({
			_id: req.params.productId,
			isDeleted: false,
		}).select({ deletedAt: 0 });
		if (!totalProducts)
			return res
				.status(404)
				.send({ status: false, message: "Product not found or deleted" });
		return res
			.status(200)
			.send({ status: true, message: "Success", data: totalProducts });
	} catch (error) {
		console.log(error);
		return res.status(500).send({ status: false, msg: error.message });
	}
};

const updateProduct = async (req, res) => {
	try {
		const productId = req.params.productId;
		const productData = req.body;
		const productImage = req.files;

		if (!validate.isValidObjectId(productId))
			return res
				.status(400)
				.send({ status: false, message: "Invalid productId" });

		if (!validate.isValidInputBody(productData))
			return res
				.status(400)
				.send({ status: false, message: "Please provide product details" });

		const presentProduct = await Product.findOne({
			_id: productId,
			isDeleted: false,
		});
		if (!presentProduct)
			return res
				.status(404)
				.send({ status: false, message: "No product found" });

		const updationFields = Object.keys(productData);
		for (field of updationFields) {
			if (!productData[field])
				return res
					.status(400)
					.send({ status: false, message: `Please provide ${field}` });
			if (!validate.isValid(productData[field]))
				return res
					.status(400)
					.send({ status: false, message: `Please provide a valid ${field}` });
		}

		const numberFields = ["price", "installments"];
		for (field of numberFields) {
			if (productData[field]) {
				if (!reg.test(productData[field])) {
					return res
						.status(400)
						.send({ status: false, message: `Invalid ${field} format` });
				}
				productData[field] = Number(productData[field]);
			}
		}

		if (productData.isFreeShipping) {
			if (
				productData.isFreeShipping != "true" &&
				productData.isFreeShipping != "false"
			)
				return res.status(400).send({
					status: false,
					message: "Please give a true or false value",
				});
			if (productData.isFreeShipping == true) productData.isFreeShipping = true;
			if (productData.isFreeShipping == false)
				productData.isFreeShipping = false;
		}

		if (productData.availableSizes) {
			if (
				!validate.isValidJSONstr(productData.availableSizes) ||
				typeof JSON.parse(productData.availableSizes) !== "object"
			)
				return res.status(400).send({
					status: false,
					message: "Please provide available sizes in an array",
				});

			let availableSizes = JSON.parse(productData.availableSizes);
			const productEnumSizes = ["S", "XS", "M", "X", "L", "XXL", "XL"];
			for (sizes of availableSizes) {
				if (!productEnumSizes.includes(sizes))
					return res.status(400).send({
						status: false,
						message: `availableSizes can be only among these: ${productEnumSizes.join(
							", "
						)}`,
					});
			}
			availableSizes = availableSizes.filter(
				(x) => !presentProduct.availableSizes.includes(x)
			);
			productData.availableSizes = availableSizes;
		}

		if (productData.currencyId) {
			if (!validate.isValid(productData.currencyId))
				return res.status(400).send({
					status: false,
					message: `Please provide a valid currencyId`,
				});
			if (productData.currencyId != "INR" && productData.currencyId != "inr")
				return res.status(400).send({
					status: false,
					message: "currencyId should be INR",
				});
		}

		if (productData.currencyFormat) {
			if (!validate.isValid(productData.currencyFormat))
				return res.status(400).send({
					status: false,
					message: `Please provide a valid currencyFormat`,
				});
			if (productData.currencyFormat != "₹")
				return res.status(400).send({
					status: false,
					message: "currencyFormat should be ₹",
				});
		}

		if (productData.title) {
			const titlePresent = await Product.findOne({ title: productData.title });
			if (titlePresent)
				return res
					.status(400)
					.send({ status: false, message: "Title already present" });
		}

		if (productImage.length > 0) {
			const fileTypes = ["image/png", "image/jpeg"];
			if (validate.acceptFileType(productImage, fileTypes))
				return res.status(400).send({
					status: false,
					message: `Invalid profileImage type. Please upload a jpg, jpeg or png file.`,
				});
			productData.productImage = await aws.uploadFile(productImage[0]);
		}

		const updateProduct = await Product.findByIdAndUpdate(
			productId,
			productData,
			{ new: true }
		);

		return res
			.status(200)
			.send({ status: true, message: "Success", data: updateProduct });
	} catch (error) {
		res.status(500).send({ status: false, message: error.message });
	}
};

const deleteProductById = async (req, res) => {
	try {
		const productId = req.params.productId;
		if (!productId)
			return res
				.status(400)
				.send({ status: false, message: "Please provide productId" });
		if (!validate.isValidObjectId(productId))
			return res
				.status(400)
				.send({ status: false, message: "Invalid ObjectId: productId" });
		const deleteProduct = await Product.findOneAndUpdate(
			{ _id: productId, isDeleted: false },
			{ isDeleted: true, deletedAt: new Date() },
			{ new: true }
		);
		if (!deleteProduct)
			return res.status(404).send({
				status: false,
				message: "Product with the given id not found",
			});
		res
			.status(200)
			.send({ status: true, message: "Document deleted successfully" });
	} catch (error) {
		return res.status(500).send({ status: false, message: error.message });
	}
};

module.exports = {
	createProduct,
	updateProduct,
	getProduct,
	getProductById,
	deleteProductById,
};
