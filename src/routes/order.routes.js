const express = require("express");
const { createOrder, getMyOrders } = require("../controllers/order.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { checkOrderLimit } = require("../middleware/orderLimit.middleware");

const router = express.Router();

router.get("/my-orders", requireAuth, getMyOrders);
router.post("/", requireAuth, checkOrderLimit, createOrder);

module.exports = router;
