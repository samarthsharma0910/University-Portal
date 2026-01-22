require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();
const PORT = 3000;

const CSV_FILE = path.join(__dirname, "users.csv");

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));


app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
},
    (accessToken, refreshToken, profile, done) => {
        const users = readUsers();
        if (!users.find(u => u.username === profile.id)) {
            addUser({
                username: profile.id,
                email: profile.emails[0].value,
                password: ""
            });
        }
        return done(null, profile);
    }
));

// Helper to read CSV
function readUsers() {
    if (!fs.existsSync(CSV_FILE)) return [];
    const data = fs.readFileSync(CSV_FILE, "utf8");
    if (!data) return [];
    return data.split("\n").map(line => {
        const [username, email, password] = line.split(",");
        return { username, email, password };
    });
}

// Helper to write a new user
function addUser(user) {
    const line = `${user.username},${user.email},${user.password}\n`;
    fs.appendFileSync(CSV_FILE, line);
}

// SIGNUP route (CSV)
app.post("/signup", (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.json({ success: false, message: "All fields are required" });
    }
    const users = readUsers();
    if (users.find(u => u.username === username)) {
        return res.json({ success: false, message: "Username already exists" });
    }
    addUser({ username, email, password });
    res.json({ success: true, redirect: "/dashboard.html" });
});

// SIGNIN route (CSV)
app.post("/signin", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: "All fields are required" });
    }
    const users = readUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.json({ success: false, message: "Invalid credentials" });
    }
    res.json({ success: true, redirect: "/dashboard.html" });
});

// ===== GOOGLE AUTH =====
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => {
        // Successful login
        res.redirect("/dashboard.html");
    });

// Logout route
app.get("/logout", (req, res) => {
    req.logout(() => {
        res.redirect("/");
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
