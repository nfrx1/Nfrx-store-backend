const prisma = require("../lib/prisma");

function formatProduct(product) {
  return {
    id: product.id,
    title: product.title,
    price: Number(product.price),
    description: product.description,
    category: product.category,
    image: product.image,
    rating: {
      rate: product.ratingRate,
      count: product.ratingCount,
    },
  };
}

async function getAllProducts(req, res) {
  try {
    const { category, search } = req.query;

    const where = {};
    if (category && category.toLowerCase() !== "all") {
      where.category = {
        equals: String(category),
        mode: "insensitive",
      };
    }

    if (search && String(search).trim() !== "") {
      where.title = {
        contains: String(search).trim(),
        mode: "insensitive",
      };
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { id: "asc" },
    });

    return res.status(200).json(products.map(formatProduct));
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to fetch products",
    });
  }
}

async function getProductById(req, res) {
  try {
    const productId = Number(req.params.id);
    if (Number.isNaN(productId)) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Invalid product ID",
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({
        error: "NotFound",
        message: "Product not found",
      });
    }

    return res.status(200).json(formatProduct(product));
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to fetch product",
    });
  }
}

async function getCategories(req, res) {
  try {
    const categories = await prisma.product.findMany({
      select: { category: true },
      distinct: ["category"],
    });
    return res.status(200).json(categories.map((c) => c.category));
  } catch (err) {
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to fetch categories",
    });
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  getCategories,
  formatProduct,
};
