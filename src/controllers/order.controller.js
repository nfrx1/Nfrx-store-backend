const prisma = require("../lib/prisma");
const { MAX_ORDERS_PER_USER } = require("../middleware/orderLimit.middleware");

const FREE_SHIPPING_THRESHOLD = 20;
const SHIPPING_FEE = 4.99;

async function createOrder(req, res) {
  try {
    const userId = req.user.id;
    const rawItems = req.body.products || req.body.items || [];
    const promoCode = req.body.promoCode
      ? String(req.body.promoCode).trim().toUpperCase()
      : null;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Cart is empty",
      });
    }

    const items = rawItems.map((item) => ({
      productId: Number(item.productId || item.id),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));

    if (items.some((item) => Number.isNaN(item.productId))) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Invalid product items",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentOrderCount = await tx.order.count({
        where: { userId },
      });

      if (currentOrderCount >= MAX_ORDERS_PER_USER) {
        const err = new Error(
          `Order limit reached (${MAX_ORDERS_PER_USER} orders maximum per account)`
        );
        err.statusCode = 403;
        err.code = "OrderLimitExceeded";
        throw err;
      }

      const productIds = items.map((i) => i.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (dbProducts.length !== new Set(productIds).size) {
        const err = new Error("One or more selected products were not found");
        err.statusCode = 404;
        err.code = "ProductNotFound";
        throw err;
      }

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      let subtotal = 0;
      const orderItemsData = items.map((item) => {
        const product = productMap.get(item.productId);
        const unitPrice = Number(product.price);
        subtotal += unitPrice * item.quantity;
        return {
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
        };
      });

      const isPromoValid = promoCode === "WELCOME20";
      const discountPercent = isPromoValid ? 20 : 0;
      const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
      const discountedSubtotal = Math.max(0, subtotal - discountAmount);
      const isFreeShipping =
        discountedSubtotal >= FREE_SHIPPING_THRESHOLD || discountedSubtotal === 0;
      const shippingCost = isFreeShipping ? 0 : SHIPPING_FEE;
      const total = Number((discountedSubtotal + shippingCost).toFixed(2));

      const order = await tx.order.create({
        data: {
          userId,
          subtotal: Number(subtotal.toFixed(2)),
          discountPercent,
          discountAmount,
          shippingCost,
          total,
          promoCode: isPromoValid ? "WELCOME20" : null,
          status: "COMPLETED",
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      await tx.cartItem.deleteMany({
        where: {
          cart: { userId },
        },
      });

      return {
        order,
        ordersCount: currentOrderCount + 1,
        remainingOrders: Math.max(0, MAX_ORDERS_PER_USER - (currentOrderCount + 1)),
      };
    });

    return res.status(201).json({
      message: "Order placed successfully",
      ...result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.code || "OrderError",
        message: err.message,
      });
    }
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to place order",
    });
  }
}

async function getMyOrders(req, res) {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      orders,
      ordersCount: orders.length,
      maxOrders: MAX_ORDERS_PER_USER,
      remainingOrders: Math.max(0, MAX_ORDERS_PER_USER - orders.length),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to fetch orders",
    });
  }
}

module.exports = {
  createOrder,
  getMyOrders,
};
