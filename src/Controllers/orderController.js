const Order = require("../Models/orderModel");
const Cart = require("../Models/cartModel");
const validate = require("../Utility/validator");

const createOrder = async function (req, res) {
	try {
		const userId = req.body.userId;
		const orderData = req.body;
		const findCart = await Cart.findOne({ userId }).lean();
		if (!findCart)
			return res.status(404).send({
				status: false,
				message: `Cart not found with the userId: ${userId}`,
			});

		if (orderData.status) {
			const statusEnum = ["pending", "completed", "cancelled"];
			if (!statusEnum.includes(orderData.status))
				return res.status(400).send({
					status: false,
					message: `status will only have one of these values: ${statusEnum.join(
						"or "
					)}`,
				});
		}

		if (orderData.cancellable) {
			if (orderData.cancellable != "true" || orderData.cancellable != "false") {
				return res.status(400).send({
					status: false,
					message: "cancellable can either be true or false",
				});
			}
			if (orderData.cancellable === "true") orderData.cancellable = true;
		}

		orderData.items = findCart.items;
		orderData.totalPrice = findCart.totalPrice;
		orderData.totalItems = findCart.totalItems;
		orderData.totalQuantity = 0;

		for (item of findCart.items) {
			orderData.totalQuantity += item.quantity;
		}

		const createOrder = await Order.create(orderData);
		return res.status(201).send({
			status: true,
			message: "Ordered created successfully",
			data: createOrder,
		});
	} catch (error) {
		return res.status(500).send({ status: false, message: error.message });
	}
};

const updateOrder = async function (req, res) {
	//todo: update isDeleted if told in the standup
	try {
		if (!validate.isValidInputBody(req.body))
			return res
				.status(400)
				.send({ status: false, message: "Please provide updation details" });
		const { orderId, status } = req.body;
		const userId = req.params.userId;
		if (!orderId || !validate.isValid(orderId))
			return res
				.status(400)
				.send({ status: false, message: "Please provide orderId" });
		if (!validate.isValidObjectId(orderId))
			return res
				.status(400)
				.send({ status: false, message: "Invalid ObjectID:orderId" });

		if (!status || !validate.isValid(status))
			return res
				.status(400)
				.send({ status: false, message: "Please provide status" });
		const statusEnum = ["pending", "completed", "cancelled"];
		if (!statusEnum.includes(status))
			return res.status(400).send({
				status: false,
				message: `status will only have one of these values: ${statusEnum.join(
					"or "
				)}`,
			});

		const isOrderPresent = await Order.findOne({
			_id: orderId,
			userId,
			isDeleted: false,
		}).lean();
		if (!isOrderPresent)
			return res.status(404).send({
				status: false,
				message: "Order with the given orderId not found",
			});
		if (status == "cancelled" && !isOrderPresent.cancellable)
			return res
				.status(400)
				.send({ status: false, message: "The order is not cancellable" });
		const updateOrder = await Order.findByIdAndUpdate(
			orderId,
			{ status },
			{ new: true }
		);
		return res.status(200).send({
			status: true,
			message: "Order status updated successfully",
			data: updateOrder,
		});
	} catch (error) {
		return res.status(500).send({ status: false, message: error.message });
	}
};
module.exports = { createOrder, updateOrder };
