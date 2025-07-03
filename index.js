const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const PORT = process.env.PORT || 8080;
const MONGOURL = process.env.MONGOURL || "your-full-mongodb-connection-url";

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

// ✅ 1. Fix Mongo connection: no deprecated options needed in latest driver
mongoose
  .connect(MONGOURL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ 2. Fix schema and model names
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const User = mongoose.model("User", userSchema); // Capitalized

const taskSchema = new mongoose.Schema({
  text: String,
  status: String,
  priority: String,
  userId: mongoose.Schema.Types.ObjectId,
});
const Task = mongoose.model("Task", taskSchema);

// ✅ 3. Register route - fix bcrypt usage
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashed = await bcrypt.hash(password, 10); // ❌ was wrong function
    const user = new User({ username, password: hashed });
    await user.save();
    res.json({ message: "User has been registered" });
  } catch (err) {
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ✅ 4. Login route - fix logic & naming
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }); // ❌ was lowercase `user`
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, "secret", { expiresIn: "1h" });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Login error" });
  }
});

// ✅ 5. Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, "secret");
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ✅ 6. Get tasks
app.get("/tasks", authMiddleware, async (req, res) => {
  const tasks = await Task.find({ userId: req.userId });
  res.json(tasks);
});

// ✅ 7. Create task
app.post("/tasks", authMiddleware, async (req, res) => {
  const task = new Task({ ...req.body, userId: req.userId });
  await task.save();
  res.json(task);
});

// ✅ 8. Delete task
app.delete("/tasks/:id", authMiddleware, async (req, res) => {
  await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId }); // ✅ fixed condition
  res.json({ message: "Task deleted" });
});

// ✅ 9. Update task status
app.patch("/tasks/:id/status", authMiddleware, async (req, res) => {
  const { status } = req.body;
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { status },
    { new: true }
  );
  if (!task) return res.status(404).json({ message: "Task not found" });
  res.json(task);
});

// ✅ 10. Update task priority
app.patch("/tasks/:id/priority", authMiddleware, async (req, res) => {
  const { priority } = req.body;
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { priority },
    { new: true }
  );
  if (!task) return res.status(404).json({ message: "Task not found" });
  res.json(task);
});

// ✅ 11. Start server
app.listen(PORT, () => console.log(`✅ Server is running on port ${PORT}`));
