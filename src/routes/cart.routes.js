const express = require("express");
const { getCart, syncCart, clearCart } = require("../controllers/cart.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/:id", getCart);
router.post("/", requireAuth, syncCart);
router.put("/:id", requireAuth, syncCart);
router.delete("/:id", requireAuth, clearCart);

module.exports = router;
