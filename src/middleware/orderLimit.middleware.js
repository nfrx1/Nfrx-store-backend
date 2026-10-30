const prisma = require("../lib/prisma");

const MAX_ORDERS_PER_USER = 2;

async function checkOrderLimit(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    const count = await prisma.order.count({
      where: { userId: req.user.id },
    });

    if (count >= MAX_ORDERS_PER_USER) {
      return res.status(403).json({
        error: "OrderLimitExceeded",
        message: `Order limit reached (${MAX_ORDERS_PER_USER} orders maximum per account)`,
        maxOrders: MAX_ORDERS_PER_USER,
        currentOrders: count,
        remainingOrders: 0,
      });
    }

    req.userOrderCount = count;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to verify order limit",
    });
  }
}

module.exports = {
  checkOrderLimit,
  MAX_ORDERS_PER_USER,
};
