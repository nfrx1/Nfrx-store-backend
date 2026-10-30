const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { JWT_SECRET } = require("../middleware/auth.middleware");
const { MAX_ORDERS_PER_USER } = require("../middleware/orderLimit.middleware");

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Username, email, and password are required",
      });
    }

    if (String(password).length < 4) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Password must be at least 4 characters",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username.trim() },
          { email: email.trim().toLowerCase() },
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "Conflict",
        message: "Username or email is already taken",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
      },
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      id: newUser.id,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        ordersCount: 0,
        remainingOrders: MAX_ORDERS_PER_USER,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to create account",
    });
  }
}

async function login(req, res) {
  try {
    const { username, email, password } = req.body;
    const identifier = (username || email || "").trim();

    if (!identifier || !password) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Username and password are required",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier.toLowerCase() },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "InvalidCredentials",
        message: "Invalid username or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        error: "InvalidCredentials",
        message: "Invalid username or password",
      });
    }

    const ordersCount = await prisma.order.count({
      where: { userId: user.id },
    });

    const token = generateToken(user);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        ordersCount,
        remainingOrders: Math.max(0, MAX_ORDERS_PER_USER - ordersCount),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Login failed",
    });
  }
}

async function getMe(req, res) {
  try {
    const ordersCount = await prisma.order.count({
      where: { userId: req.user.id },
    });

    return res.status(200).json({
      user: {
        ...req.user,
        ordersCount,
        maxOrders: MAX_ORDERS_PER_USER,
        remainingOrders: Math.max(0, MAX_ORDERS_PER_USER - ordersCount),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to fetch user profile",
    });
  }
}

module.exports = {
  register,
  login,
  getMe,
};
