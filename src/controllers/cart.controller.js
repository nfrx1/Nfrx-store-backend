const prisma = require("../lib/prisma");

async function getCart(req, res) {
  try {
    const userId = req.user?.id || Number(req.params.id) || 1;

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      return res.status(200).json({
        id: userId,
        userId,
        products: [],
        items: [],
      });
    }

    return res.status(200).json({
      id: cart.id,
      userId: cart.userId,
      products: cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      items: cart.items.map((item) => ({
        id: item.product.id,
        title: item.product.title,
        price: Number(item.product.price),
        description: item.product.description,
        category: item.product.category,
        image: item.product.image,
        quantity: item.quantity,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to fetch cart",
    });
  }
}

async function syncCart(req, res) {
  try {
    const userId = req.user.id;
    const products = req.body.products || [];

    const cart = await prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    if (Array.isArray(products) && products.length > 0) {
      for (const item of products) {
        const productId = Number(item.productId || item.id);
        const quantity = Math.max(1, Number(item.quantity) || 1);
        if (!Number.isNaN(productId)) {
          await prisma.cartItem.create({
            data: {
              cartId: cart.id,
              productId,
              quantity,
            },
          });
        }
      }
    }

    return res.status(200).json({
      id: cart.id,
      userId,
      products,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to sync cart",
    });
  }
}

async function clearCart(req, res) {
  try {
    const userId = req.user.id;
    await prisma.cartItem.deleteMany({
      where: {
        cart: { userId },
      },
    });

    return res.status(200).json({
      message: "Cart cleared successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to clear cart",
    });
  }
}

module.exports = {
  getCart,
  syncCart,
  clearCart,
};
