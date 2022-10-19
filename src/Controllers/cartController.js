const Cart = require("../Models/cartModel");
const Product = require("../Models/productModel");
const validate = require("../Utility/validator");
const reg = new RegExp("^[0-9]+$");

const createCart = async function (req, res) {
	try {
		const userId = req.params.userId;
		const { cartId, productId } = req.body;
		if (!validate.isValidInputBody(req.body))
			return res
				.status(400)
				.send({ status: false, message: "Please provide cart details" });

		if (productId) {
			if (!validate.isValidObjectId(productId))
				return res
					.status(400)
					.send({ status: false, message: `Invalid productId: ${productId}` });
		} else {
			return res
				.status(400)
				.send({ status: false, message: "Please provide productId" });
		}

		if (cartId) {
			if (!validate.isValidObjectId(cartId))
				return res
					.status(400)
					.send({ status: false, message: `Invalid productId: ${cartId}` });
			const findCart = await Cart.findById(cartId);
			if (!findCart)
				return res.status(404).send({
					status: false,
					message: `Cart with the cartId: ${cartId} is not present`,
				});
		}

		const cartExists = await Cart.findOne({ userId }).lean();
		if (cartExists && cartExists.items.length > 0) {
			if (!cartId)
				return res
					.status(400)
					.send({ status: false, message: "Please provide cartId" });
			if (cartId !== cartExists["_id"].toString())
				return res.status(400).send({
					status: false,
					message: "cartId doesn't match with the one present for the user",
				});
			const availableItems = [];
			const unavailableItems = [];
			cartExists.totalPrice = 0;
			for (item of cartExists.items) {
				const findProduct = await Product.findOne({
					_id: item.productId,
					isDeleted: false,
				}).lean();
				if (!findProduct) unavailableItems.push(item.productId);
				else {
					availableItems.push(item);
					cartExists.totalPrice += findProduct.price * item.quantity;
				}
			}
			cartExists.items = [...availableItems];
			const findProduct = await Product.findOne({
				_id: productId,
			}).lean();
			let flag = false;
			if (findProduct.isDeleted == false && cartExists.items.length > 0) {
				for (item of cartExists.items) {
					if (item.productId.toString() == productId) {
						item.quantity += 1;
						flag = false;
						break;
					} else {
						flag = true;
					}
				}
				if (flag) cartExists.items.push({ productId });
				cartExists.totalPrice += findProduct.price;
			} else if (cartExists.items.length == 0) {
				cartExists.items.push({ productId });
				cartExists.totalPrice += findProduct.price;
			} else if (findProduct.isDeleted == true) {
				return res.status(404).send({
					status: false,
					message: `Product with the given productId: ${productId} is out of stock`,
				});
			} else {
				return res.status(404).send({
					status: false,
					message: `Product with the given productId: ${productId} doesn't exist`,
				});
			}
			cartExists.totalItems = cartExists.items.length;

			const updateCart = await Cart.findByIdAndUpdate(cartId, cartExists, {
				new: true,
			});
			if (unavailableItems.length > 0) {
				return res.status(200).send({
					status: true,
					message: `Products with the id(s): ${unavailableItems.join(
						", "
					)} went out of stock`,
					data: updateCart,
				});
			} else {
				return res.status(200).send({
					status: true,
					message: `Cart updated successfully`,
					data: updateCart,
				});
			}
		}

		const findProduct = await Product.findOne({
			_id: productId,
			isDeleted: false,
		}).lean();
		if (!findProduct)
			return res.status(404).send({
				status: false,
				message: `Product with the given productId: ${productId} not found`,
			});
		const cartData = {};
		cartData.items = [{ productId }];
		cartData.totalItems = 1;
		cartData.totalPrice = findProduct.price;
		cartData.userId = userId;
		if (cartExists && cartExists.items.length < 1) {
			const updateCart = await Cart.findByIdAndUpdate(cartId, cartData, {
				new: true,
			});
			return res
				.status(200)
				.send({ status: true, message: "Success", data: updateCart });
		}
		const createCart = await Cart.create(cartData);
		return res
			.status(201)
			.send({ status: true, message: "Success", data: createCart });
	} catch (error) {
		return res.status(500).send({ status: false, message: error.message });
	}
};

const updateCart = async function (req, res) {
	try {
		let { cartId, productId, removeProduct } = req.body;
		if (!validate.isValidInputBody(req.body))
			return res.status(400).send({
				status: false,
				message: "Please provide cart updation details",
			});

		const mandatoryFields = ["cartId", "productId", "removeProduct"];
		for (field of mandatoryFields) {
			if (!req.body[field])
				return res
					.status(400)
					.send({ status: false, message: `Please provide ${field}` });
			if (!validate.isValid(req.body[field]))
				return res
					.status(400)
					.send({ status: false, message: `Please provide a valid ${field}` });
		}

		if (!reg.test(Number(removeProduct))) {
			return res
				.status(400)
				.send({ status: false, message: "Not a valid removeProduct" });
		}
		removeProduct = Number(removeProduct);
		if (removeProduct != 1 && removeProduct != 0)
			return res.status(400).send({
				status: false,
				message: "removeProduct's value can only be 1 or 0",
			});
		mandatoryFields.pop();
		for (field of mandatoryFields) {
			if (!validate.isValidObjectId(req.body[field]))
				return res
					.status(400)
					.send({ status: false, message: `Invalid ObjectId:${field}` });
		}

		const cartExists = await Cart.findById(cartId);
		if (cartExists) {
			const productExistsInCart = await Cart.findOne({
				items: { $elemMatch: { productId } },
			}).lean();
			if (!productExistsInCart)
				return res.status(400).send({
					status: false,
					message: `Product with productId ${productId} doesn't exist in the cart`,
				});

			let productQuantity = productExistsInCart.items.find((item) => {
				if (item.productId.toString() == productId) return item.quantity;
			});

			const productExists = await Product.findOne({
				_id: productId,
				isDeleted: false,
			}).lean();
			if (
				removeProduct == 0 ||
				productQuantity.quantity - removeProduct < 1 ||
				productExists.isDeleted == true
			) {
				const updateCart = await Cart.findByIdAndUpdate(
					cartId,
					{
						$pull: { items: { productId } },
						$inc: {
							totalItems: -1,
							totalPrice: -(productQuantity.quantity * productExists.price),
						},
					},
					{ new: true }
				);
				return res
					.status(200)
					.send({ status: true, message: "Success", data: updateCart });
			} else {
				const updateCart = await Cart.findOneAndUpdate(
					{ "items.productId": { _id: productId } },
					{
						$inc: {
							totalPrice: -(removeProduct * productExists.price),
							"items.$.quantity": -removeProduct,
						},
					},
					{ new: true }
				);
				return res
					.status(200)
					.send({ status: true, message: "Success", data: updateCart });
			}
		} else {
			return res.status(400).send({
				status: false,
				message: `Cart with the cartId: ${cartId} doesn't exist`,
			});
		}
	} catch (error) {
		return res.status(500).send({ status: false, message: error.message });
	}
};

const getCart = async function (req, res) {
	try {
		const userId = req.params.userId;
		const findCart = await Cart.findOne({ userId }).populate({
			path: "items",
			populate: {
				path: "productId",
				model: "Product",
				select: { title: 1, productImage: 1, style: 1, price: 1, _id: 0 },
			},
		});
		if (!findCart)
			return res.status(404).send({
				status: false,
				message: `Cart with userId: ${userId} not found`,
			});
		return res
			.status(200)
			.send({ status: true, message: "Success", data: findCart });
	} catch (error) {
		return res.status(500).send({ status: false, message: error.message });
	}
};

const deleteCart = async function (req, res) {
	try {
		const userId = req.params.userId;
		const findCart = await Cart.findOne({ userId }).lean();
		if (!findCart)
			return res.status(404).send({
				status: false,
				message: `Cart with userId: ${userId} not found`,
			});

		if (findCart.items.length == 0) return res.status(204).send();
		findCart.items = [];
		findCart.totalItems = 0;
		findCart.totalPrice = 0;
		const deleteCart = await Cart.findOneAndUpdate({ userId }, findCart);
		return res.status(204).send();
	} catch (error) {
		return res.status(500).send({ status: false, message: error.message });
	}
};

module.exports = { createCart, updateCart, getCart, deleteCart };
