const express = require('express');
const app = express();
const cors = require('cors');
const dotenv = require('dotenv').config();

const connectDB = require('./config/mongo');
const authMiddleware = require('./config/auth0');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Added 'extended' option
app.use(authMiddleware);

// Connect to DB only when handling requests, not on module load
let isConnected = false;
const ensureDbConnected = async () => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
};

// Add middleware to ensure DB connection before routes
app.use(async (req, res, next) => {
  await ensureDbConnected();
  next();
});

// Models
const User = require('./models/User');
const Course = require('./models/Course');
const Challenge = require('./models/Challenge');

// Route imports
const getProfileRoute = require('./routes/getProfile');
const createCourse = require('./routes/createCourse');
const getProgrammingChallengesRoute = require('./routes/challenges/programming/programming');

// Route use
app.use('/get-profile', getProfileRoute);
app.use('/create-course', createCourse);
app.use('/challenges/programming', getProgrammingChallengesRoute);

app.get("/", (req, res) => res.send("Express on Vercel"));

app.get("/api/user/:email", async (req, res) => {
  const email = req.params.email;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const { _id, ...cleanUser } = user.toObject();
  res.status(200).json(cleanUser);
});

app.post("/api/user", async (req, res) => {
  const { email, xp, level } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    const { _id, ...cleanUser } = existing.toObject();
    return res.status(200).json(cleanUser);
  }

  const newUser = new User({ email, xp, level });
  await newUser.save();

  const { _id, ...cleanNewUser } = newUser.toObject();
  res.status(201).json(cleanNewUser);
});

app.post("/api/course", async (req, res) => {
  try {
    const { email, title, topics } = req.body;

    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ error: "No user found" });
    }

    const createdAt = new Date(); 

    const newCourse = new Course({
      title,
      topics,
      createdAt,
      user: existingUser._id 
    });

    await newCourse.save();

    res.status(201).json({ message: "Course created", course: newCourse });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});


const levelThresholds = [
  0,    // Level 1
  50,   // Level 2
  120,  // Level 3
  200,  // Level 4
  300,  // Level 5
  420,  // Level 6
  560,  // Level 7
  720,  // Level 8
  900,  // Level 9
  1100, // Level 10
  1320, // Level 11
  1560, // Level 12
  1820, // Level 13
  2100, // Level 14
  2400, // Level 15
  2720, // Level 16
  3060, // Level 17
  3420, // Level 18
  3800, // Level 19
  4200, // Level 20
];

function calculateLevel(xp) {
  for (let i = levelThresholds.length - 1; i >= 0; i--) {
    if (xp >= levelThresholds[i]) return i + 1;
  }
  return 1;
}

app.post("/api/update-xp", async (req, res) => {
  try {
    const { useremail, xpgained, npcID } = req.body;
    console.log("inside update server call");

    if (!useremail || !xpgained || !npcID) {
      console.log(req.body);
      return res.status(400).json({ error: "Missing required query parameters." });
    }

    let user = await User.findOne({ email: useremail });
    console.log(user);

    if (!user) {
      user = await User.create({email: useremail, level: 0, xp: 0});
    }

    const newXP = user.xp + parseInt(xpgained);
    const newLevel = calculateLevel(newXP);

    const updatedUser = await User.findOneAndUpdate(
      { email: useremail }, 
      {
        $set: { xp: newXP, level: newLevel },
        $addToSet: { npcIDs: npcID },
      },
      { new: true }
    );

    res.status(200).json({
      message: "XP and level updated successfully.",
      updatedUser,
    });

  } catch (err) {
    console.error("Error in /update-xp:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// For local development only
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('Backend server listening on port ', PORT);
  });
}

// Export the Express app for serverless deployment
module.exports = app;