const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const cartSchema = new mongoose.Schema(
	{
		userId: {
			type: ObjectId,
			ref: "User",
			required: true,
			unique: true,
		},
		items: [
			{
				productId: {
					type: ObjectId,
					ref: "Product",
					required: true,
				},
				quantity: { type: Number, default: 1 },
				_id: false,
			},
		],
		totalPrice: { type: Number, required: true, default: 0 },
		totalItems: { type: Number, required: true, default: 0 },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);
