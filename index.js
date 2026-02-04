import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import bcrypt from "bcrypt";
import pg from "pg";
import passport from "passport";
import env from "dotenv";
import { Strategy } from "passport-local";
import otpGenerator from "otp-generator";
import flash from "connect-flash";

const app = express();
const port = process.env.PORT || 3000;
env.config();
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    }
});
app.set("view engine", "ejs");
app.set("views", "./views");

db.connect().then(() => console.log("Connected to db")).catch((err) => console.log("Error connecting to db", err));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}))
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.locals.error = req.flash("error");
    res.locals.isAuthenticated = req.isAuthenticated();
    next();
});



app.get("/", (req, res) => {
    res.render("index.ejs", { isAuthenticated: req.isAuthenticated() });
});

app.get("/update", (req, res) => {
    if (req.isAuthenticated()) {
        let message = req.session.message;
        req.session.message = null;
        res.render("update.ejs", { message });
    }
    else {
        res.redirect("/login");
    }
});

app.get("/profile", async (req, res) => {
    let user = req.user;
    if (!user) return res.redirect("/login");

    let result = await db.query("SELECT SUM(amount) AS TOTAL_EXPENSE FROM expenses WHERE user_id = $1", [user.id]);
    let total_expense = result.rows[0].total_expense || 0;

    let category_res = await db.query("SELECT SUM(amount) AS TOTAL,category FROM expenses WHERE user_id = $1 GROUP BY category ORDER BY TOTAL DESC LIMIT 1", [user.id]);

    let most_spent = "No Data";
    let most_spent_amount = 0;

    if (category_res.rows.length > 0) {
        most_spent = category_res.rows[0].category;
        most_spent_amount = category_res.rows[0].total;
    }

    res.render("profile.ejs", { user, total_expense, most_spent, most_spent_amount });
});

app.get("/signup", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect("/update");
    } else {
        res.render("signup.ejs", { error: req.session.error });
        req.session.error = null;
    }
});

app.get("/login", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect("/update");
    } else {
        res.render("login.ejs");
    }
});

app.get("/track", async (req, res) => {
    if (req.isAuthenticated()) {
        const titles = [
            "Track Your Spending Regularly",
            "Create a Realistic Budget and Stick to It",
            "Use the 24-Hour Rule to Avoid Impulse Purchases",
            "Cancel Unused Subscriptions and Memberships",
            "Cook at Home Instead of Dining Out",
            "Buy Groceries in Bulk and Stick to a Shopping List",
            "Take Advantage of Coupons, Discount Codes, and Cashback Offers",
            "Limit Online Shopping and Unsubscribe from Marketing Emails",
            "Opt for Generic or Store-Brand Products Instead of Name Brands",
            "Use Public Transportation or Carpool Instead of Driving Alone",
            "Pay Bills on Time to Avoid Late Fees and Interest Charges",
            "Review and Compare Your Insurance Policies Annually",
            "Reduce Electricity and Water Usage to Lower Utility Bills",
            "Limit Credit Card Use and Avoid Carrying a Balance",
            "Learn Basic DIY Skills to Save on Repairs and Services",
            "Always Shop with a List and Compare Prices Before Buying",
            "Take Advantage of Sales and Buy Seasonal Items Off-Season",
            "Negotiate Your Bills for Better Rates",
            "Consider Buying Second-Hand or Refurbished Items Instead of New",
            "Set Clear Savings Goals and Automate Contributions"
        ];
        const tips = [
            "Keeping a close eye on your spending habits is the first step to better financial management. Use budgeting apps, spreadsheets, or even a simple notebook to log every expense, no matter how small. Over time, this will help you recognize patterns and identify areas where you can cut back without sacrificing much.",
            "A well-planned budget allows you to control your finances instead of letting your finances control you. Categorize your income and expenses, set limits for discretionary spending, and make sure you allocate enough for savings. Adjust your budget monthly based on actual expenses.",
            "Before buying something non-essential, wait 24 hours to determine if you still want or need it. This delay helps you make more thoughtful financial decisions and avoid wasting money on things that provide only short-term satisfaction.",
            "Many people forget about streaming services, gym memberships, and other subscriptions that silently drain their bank accounts. Review your statements regularly and cancel anything you don’t actively use or need. Consider sharing subscriptions with family or friends to cut costs.",
            "Restaurants and takeout meals can be significantly more expensive than home-cooked meals. Plan your meals for the week, prepare your own coffee, and pack your lunch for work. Not only will this save money, but it also allows you to eat healthier.",
            "Buying non-perishable and frequently used grocery items in bulk can save you money in the long run. Before shopping, make a list of what you truly need and avoid impulse purchases. Shopping on a full stomach can also prevent unnecessary spending on snacks and treats.",
            "Before making any purchase, check if there are available coupons or discount codes online. Use cashback apps or credit cards that offer cashback rewards on purchases. Small savings on each transaction add up over time.",
            "Online shopping makes it easy to spend money impulsively. To curb this, remove saved payment details from websites and unsubscribe from marketing emails that tempt you with constant deals. If you don’t see it, you’re less likely to buy it.",
            "Many store-brand products offer the same quality as name-brand items at a lower price. This applies to groceries, medicine, household supplies, and more. Compare ingredients and reviews before making a decision.",
            "Owning and maintaining a vehicle is expensive. Gas, insurance, repairs, and parking costs add up quickly. If possible, use public transportation, bike, or walk to your destinations. If driving is necessary, carpooling with coworkers or friends can reduce fuel costs.",
            "Late fees and interest can quickly turn small expenses into major financial burdens. Set up automatic payments or reminders for your bills to ensure you never miss a due date. Paying off credit card balances in full each month will also save you from high-interest charges.",
            "Many people overpay for insurance because they don’t review their policies regularly. Check your auto, home, health, and life insurance rates at least once a year and compare them with other providers. Switching to a better plan could save you hundreds of dollars.",
            "Simple changes like turning off lights when not in use, unplugging electronics, using energy-efficient appliances, and reducing water waste can significantly lower your monthly utility bills. Consider switching to LED bulbs and installing a programmable thermostat for further savings.",
            "Credit cards can be useful, but high-interest debt can quickly spiral out of control. Only use credit cards when necessary, and always aim to pay the full balance each month. If you already have credit card debt, focus on paying it off as quickly as possible to avoid excessive interest payments.",
            "Hiring professionals for minor home repairs, maintenance, or even car issues can be costly. Learning how to fix small things yourself—such as changing a light fixture, fixing a leaky faucet, or changing your car’s oil—can save you a lot of money in the long run.",
            "Before making any purchase, research prices from different stores to ensure you’re getting the best deal. Avoid buying things just because they are on sale. Sticking to a shopping list prevents you from buying unnecessary items.",
            "Retailers often discount products at the end of a season. Buy winter clothes in spring, summer items in fall, and holiday decorations after the holidays to get the best prices. Shopping ahead of time can result in substantial savings.",
            "Many service providers—such as internet, cable, and cell phone companies—offer discounts to retain customers. Call them and ask if they can lower your bill, match a competitor’s price, or provide a promotional rate. You’d be surprised how often they say yes.",
            "Many products, from furniture to electronics, can be bought second-hand at a fraction of the cost of new ones. Websites like Craigslist, Facebook Marketplace, and thrift stores offer excellent deals. If buying electronics, consider manufacturer-refurbished products with warranties.",
            "Saving money is easier when you have a clear goal. Whether it’s building an emergency fund, saving for a vacation, or planning for retirement, set a target amount and a deadline. Automate your savings by setting up direct transfers to your savings account each payday."
        ];
        let titleIndex = Math.floor(Math.random() * titles.length);
        let tipIndex = Math.floor(Math.random() * tips.length);
        let title = titles[titleIndex];
        let tip = tips[tipIndex];
        let contRes = await db.query(`SELECT users.update_streak , SUM(expenses.amount) AS total, expenses.category
        FROM expenses
        INNER JOIN users ON expenses.user_id = users.id
        WHERE expenses.user_name = $1
        GROUP BY users.update_streak , expenses.category
        ORDER BY total DESC`, [req.user.email]);
        let streak = 0;
        let mostSpentCategory = "No category available";
        if (contRes.rows.length > 0) {
            streak = contRes.rows[0].update_streak;
            mostSpentCategory = contRes.rows[0].category;
        }
        let result = await db.query(`
    select sum(amount) as total,category
    from expenses
    where user_name = $1
    group by category`, [req.user.email]);
        let label = result.rows.map(row => row.category);
        let data = result.rows.map(row => row.total);
        if (label.length == 0) {
            label = ["No data"],
                data = [0];
        }
        let chartUrl = "https://quickchart.io/chart?c=" + encodeURIComponent(JSON.stringify({
            type: "line",
            data: {
                labels: label,
                datasets: [{
                    label: "Amount",
                    data: data,
                    backgroundColor: "rgba(255, 0, 0,0.2)",
                }]
            }
        }));
        const expensesResult = await db.query(
            `SELECT amount, add_date, category, notes
         FROM expenses
         WHERE user_name = $1
         ORDER BY add_date DESC, id DESC LIMIT 5`,
            [req.user.email]
        );
        const expenses = expensesResult.rows;
        req.user.streak = streak;
        req.user.mostSpentCategory = mostSpentCategory;
        req.user.tip = tip;
        req.user.title = title;
        res.render("track.ejs", {
            chartUrl,
            streak,
            mostSpentCategory,
            tip,
            title,
            expenses,
        });
    }
    else {
        res.redirect("/login");
    }
});

app.get("/history", async (req, res) => {
    if (req.isAuthenticated()) {
        const expensesResult = await db.query(
            `SELECT amount, add_date, category, notes
         FROM expenses
         WHERE user_name = $1
         ORDER BY add_date DESC, id DESC`,
            [req.user.email]
        );
        const expenses = expensesResult.rows;
        res.render("history.ejs", { expenses });
    } else {
        res.redirect("/login");
    }
});

app.get("/forgot", (req, res) => {
    res.render("forgot.ejs");
});

app.get("/logout", (req, res) => {
    req.logout(err => {
        if (err) {
            console.error("Error is:");
        }
        else {
            res.redirect("/");
        }
    })
});

app.post("/track", async (req, res) => {
    if (req.isAuthenticated()) {
        let type = req.body.type;
        let qry;
        switch (type) {
            case "bar": qry = "SELECT add_date,SUM(amount) AS total FROM expenses WHERE user_name = $1 GROUP BY add_date";
                break;

            case "line": qry = "SELECT DATE_TRUNC('week',add_date) AS week,SUM(amount) AS total FROM expenses WHERE user_name=$1 GROUP BY week";
                break;

            case "pie": qry = "SELECT SUM(amount) AS total, category FROM expenses WHERE user_name = $1 GROUP BY category ORDER BY category";
                break;

            case "radar": qry = "SELECT SUM(amount) AS total, category FROM expenses WHERE user_name = $1 GROUP BY category ORDER BY category";
                break;
        }
        const result = await db.query(qry, [req.user.email]);
        let baseUrl = "https://quickchart.io/chart?c=";
        let chartUrl, label, data;
        switch (type) {
            case "bar": label = result.rows.map(row => row.add_date.toISOString().split("T")[0]);
                data = result.rows.map(row => row.total);
                chartUrl = baseUrl + encodeURIComponent(JSON.stringify({
                    type: "bar",
                    data: {
                        labels: label,
                        datasets: [{
                            label: "Expenses",
                            backgroundColor: "rgba(85, 107, 47,0.8)",
                            data: data,
                        }]
                    }
                }));
                break;
            case "line": label = result.rows.map(row => row.week.toISOString().split("T")[0]);
                data = result.rows.map(row => row.total);
                chartUrl = baseUrl + encodeURIComponent(JSON.stringify({
                    type: "line",
                    data: {
                        labels: label,
                        datasets: [{
                            label: "Expenses",
                            backgroundColor: "rgba(85,107,47,0.2)",
                            borderColor: "rgba(85,107,47,1)",
                            data: data,
                        }]
                    }
                }));
                break;
            case "pie": label = result.rows.map(row => row.category);
                data = result.rows.map(row => row.total);
                chartUrl = baseUrl + encodeURIComponent(JSON.stringify({
                    type: "outlabeledPie",
                    data: {
                        labels: label,
                        datasets: [{
                            backgroundColor: ["rgba(85,107,47,1)", "rgba(103, 107, 47, 1)", "rgba(47, 107, 89, 1)", "rgba(107, 59, 47, 1)", "rgba(107, 47, 104, 1)"],
                            data: data,
                        }]
                    },
                    "options": {
                        "plugins": {
                            "outlabels": {
                                "textcolor": "white",
                            }
                        }
                    }
                }));
                break;
            case "radar": label = result.rows.map(row => row.category);
                data = result.rows.map(row => row.total);
                chartUrl = baseUrl + encodeURIComponent(JSON.stringify({
                    type: "radar",
                    data: {
                        labels: label,
                        datasets: [{
                            label: "Expenses",
                            data: data,
                        }]
                    }
                }));
                break;

        }
        const expensesResult = await db.query(
            `SELECT amount, add_date, category, notes
         FROM expenses
         WHERE user_name = $1
         ORDER BY add_date DESC, id DESC LIMIT 5`,
            [req.user.email]
        );
        const expenses = expensesResult.rows;
        res.render("track.ejs", {
            chartUrl,
            mostSpentCategory: req.user.mostSpentCategory,
            streak: req.user.streak,
            tip: req.user.tip,
            title: req.user.title,
            expenses,
        });
    }
    else {
        res.redirect("/login");
    }
});

app.post("/verify", async (req, res) => {
    let user_email = req.body.otp_email;
    let otp = await otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        specialChars: false,
    });
    req.session.otp_generated = otp;
    const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff; overflow: hidden;">
            <div style="background-color: #2F4B26; padding: 30px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">PennyPilot</h1>
                <p style="color: #B5b25C; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Your Personal Finance Assistant</p>
            </div>
            <div style="padding: 40px 30px; text-align: center; color: #333333;">
                <h2 style="color: #2F4B26; margin-top: 0;">Verify Your Email</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #555555; margin-bottom: 30px;">
                    Thank you for signing up with PennyPilot! To complete your registration and start tracking your expenses, please use the following One-Time Password (OTP).
                </p>
                <div style="background-color: #f4f7f2; display: inline-block; padding: 15px 30px; border-radius: 8px; border: 2px dashed #B5b25C; margin-bottom: 30px;">
                    <span style="font-size: 32px; font-weight: bold; color: #2F4B26; letter-spacing: 5px;">${otp}</span>
                </div>
                <p style="font-size: 14px; color: #888888; margin-bottom: 0;">
                    This OTP is valid for 10 minutes. Please do not share this code with anyone.
                </p>
            </div>
            <div style="background-color: #2F4B26; padding: 20px; text-align: center; font-size: 12px; color: #a0c29a;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} PennyPilot. All rights reserved.</p>
                <p style="margin: 5px 0 0 0;">Secure Expense Tracking | Financial Freedom</p>
            </div>
        </div>
    `;
    await sendEmail(user_email, "PennyPilot Account Verification", htmlContent);

    return res.json({ msg: "OTP sent successfully" });

});

app.post("/signup", async (req, res) => {
    let email = req.body.email;
    let usr_name = req.body.usr_name;
    let password = req.body.password;
    let otp_entered = req.body.otp;
    console.log(otp_entered);
    if (!req.session.otp_generated || otp_entered !== req.session.otp_generated) {
        req.session.error = "Wrong OTP. Please try again";
        return res.redirect("/signup");
    }
    let checkRes = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkRes.rows.length == 0) {
        let hash = await bcrypt.hash(password, 10);
        let result = await db.query("INSERT INTO users (email,password,usr_name) VALUES($1,$2,$3) RETURNING *", [email, hash, usr_name]);
        let user = result.rows[0];
        req.login(user, (err) => {
            if (err)
                console.error("Error is:", err);
            res.redirect("/update");
        });
    }
    else {
        let user = checkRes.rows[0];
        req.login(user, (err) => {
            if (err)
                console.error("Error is :", err);
            res.redirect("/update");
        });
    }


});

app.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            req.flash("error", info.message);
            return res.redirect("/login");
        }
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.redirect("/update");
        });
    })(req, res, next);
});


app.post("/update", async (req, res) => {
    let amount = parseInt(req.body.amount.replace(/,/g, ""), 10);
    let category = req.body.category;
    let date = req.body.date;
    let notes = req.body.notes;
    if (req.isAuthenticated()) {
        const idRes = await db.query(`SELECT id FROM users WHERE email = $1`, [req.user.email]);
        let id = idRes.rows[0].id;
        const result = await db.query("INSERT INTO expenses(amount,category,add_date,notes,user_name,user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [amount, category, date, notes, req.user.email, id]);
        let streak = await db.query(`
            UPDATE users
            SET 
            update_streak = CASE
            WHEN last_update IS NULL THEN 1
            WHEN last_update = CURRENT_DATE - INTERVAL '1 day' THEN update_streak+1
            WHEN last_update < CURRENT_DATE - INTERVAL '1 day' THEN 0
            ELSE update_streak
            END,
            last_update = CURRENT_DATE
            WHERE email = $1
            RETURNING * 
            `, [req.user.email]);
        req.session.message = "Expenses added successfully!";

        res.redirect("/update");
    }
    else {
        res.redirect("/signup");
    }
});

app.post("/otp", async (req, res) => {
    let email = req.body.email;
    let result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length == 0) {
        return res.json({ msg: "No such user found" });
    }
    else {
        let otp = await otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
        });
        req.session.password_otp = otp;
        req.session.reset_email = email; // Securely bind OTP to this email

        const htmlContent = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff; overflow: hidden;">
                <div style="background-color: #B5b25C; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">PennyPilot</h1>
                    <p style="color: #2F4B26; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Your Personal Finance Assistant</p>
                </div>
                <div style="padding: 40px 30px; text-align: center; color: #333333;">
                    <h2 style="color: #2F4B26; margin-top: 0;">Password Recovery</h2>
                    <p style="font-size: 16px; line-height: 1.6; color: #555555; margin-bottom: 30px;">
                        We received a request to reset your password. Use the following OTP to proceed.
                    </p>
                    <div style="background-color: #f9f9f9; display: inline-block; padding: 15px 30px; border-radius: 8px; border: 2px dashed #2F4B26; margin-bottom: 30px;">
                        <span style="font-size: 32px; font-weight: bold; color: #B5b25C; letter-spacing: 5px;">${otp}</span>
                    </div>
                    <p style="font-size: 14px; color: #888888; margin-bottom: 0;">
                        If you didn't request this change, you can safely ignore this email.
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999999;">
                    <p style="margin: 0;">&copy; ${new Date().getFullYear()} PennyPilot. All rights reserved.</p>
                </div>
            </div>
        `;
        await sendEmail(email, "PennyPilot Password Reset", htmlContent);
        return res.json({ msg: "otp sent" });
    }
});

app.post("/forgot", async (req, res) => {
    let password = req.body.newPassword;
    // SECURITY FIX: Ignore req.body.email, use session email
    let email = req.session.reset_email;
    let otp_generated = req.session.password_otp;
    let otp_entered = req.body.otp_entered;

    if (!email || !otp_generated) {
        return res.json({ msg: "Session expired or invalid request. Please request OTP again." });
    }

    if (otp_generated.trim() == otp_entered.trim()) {
        let hash = await bcrypt.hash(password, 10);
        req.session.password_otp = null;
        req.session.reset_email = null; // Clear session data
        let result = await db.query(`UPDATE users SET password = $1 WHERE email = $2`, [hash, email]);
        return res.json({ msg: "Password changed successfully" });
    }
    else {
        return res.json({ msg: "Invalid OTP" });
    }

});

passport.use("local", new Strategy(async function verify(username, password, cb) {
    try {
        const checkRes = await db.query("SELECT * FROM users WHERE email = $1 OR usr_name = $1 OR email = $1 || '@gmail.com'", [username]);
        if (checkRes.rows.length === 0) {
            console.log("No user found");
            return cb(null, false, { message: "No user found with this email" });
        }
        else {
            let user = checkRes.rows[0];
            let valid = await bcrypt.compare(password, user.password);
            if (valid) {
                console.log("Passwords matched");
                return cb(null, user);
            }
            else {
                console.log("Passwords not matched");
                return cb(null, false, { message: "Passwords doesn't match" });
            }
        }
    }
    catch (err) {
        console.log("Verification error");
        console.error("Error:", err);
        return cb(err);
    }
}));

passport.serializeUser((user, cb) => {
    return cb(null, user);
});
passport.deserializeUser((user, cb) => {
    return cb(null, user);
});


// Helper function to send email via Brevo API
const sendEmail = async (to, subject, htmlContent) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.error("BREVO_API_KEY is missing");
        return;
    }

    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api-key": apiKey,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                sender: { email: process.env.EMAIL_USERNAME, name: "PennyPilot" },
                to: [{ email: to }],
                subject: subject,
                htmlContent: htmlContent
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Brevo API Error: ${JSON.stringify(data)}`);
        }
        console.log(`Email sent to ${to} via Brevo. MessageId: ${data.messageId}`);
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error.message);
    }
};

app.get("/cron/monthly-report", async (req, res) => {


    try {
        const result = await db.query("SELECT * FROM users");
        const users = result.rows;
        res.status(200).json({ message: "Monthly reports triggered." });

        for (const user of users) {
            if (!user.email) continue;

            // Get first and last day of current month
            const date = new Date();
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

            // 1. Total Spent
            const totalRes = await db.query(
                "SELECT SUM(amount) as total FROM expenses WHERE user_id = $1 AND add_date >= $2 AND add_date <= $3",
                [user.id, firstDay, lastDay]
            );
            const totalSpent = totalRes.rows[0].total || 0;
            const income = user.monthly_income || 0;
            const savings = income - totalSpent;
            const savingsStatus = savings >= 0 ? "Positive Savings" : "Over Budget";

            // 2. Most Spent Category
            const catRes = await db.query(
                "SELECT category, SUM(amount) as total FROM expenses WHERE user_id = $1 AND add_date >= $2 AND add_date <= $3 GROUP BY category ORDER BY total DESC LIMIT 1",
                [user.id, firstDay, lastDay]
            );
            const topCategory = catRes.rows.length > 0 ? catRes.rows[0].category : "None";
            const topCategoryAmount = catRes.rows.length > 0 ? catRes.rows[0].total : 0;

            // 3. Max Spending Day
            const dayRes = await db.query(
                "SELECT add_date, SUM(amount) as total FROM expenses WHERE user_id = $1 AND add_date >= $2 AND add_date <= $3 GROUP BY add_date ORDER BY total DESC LIMIT 1",
                [user.id, firstDay, lastDay]
            );
            let maxDay = "None";
            let maxDayAmount = 0;
            if (dayRes.rows.length > 0) {
                maxDay = new Date(dayRes.rows[0].add_date).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                maxDayAmount = dayRes.rows[0].total;
            }

            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #2F4B26; text-align: center;">📊 Your Monthly Financial Report</h2>
                    <p>Here is your spending summary for this month:</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p><strong>💰 Monthly Income:</strong> ₹${income}</p>
                        <p><strong>💸 Total Spent:</strong> ₹${totalSpent}</p>
                        <p><strong>🏦 Savings:</strong> <span style="color: ${savings >= 0 ? 'green' : 'red'}">₹${savings} (${savingsStatus})</span></p>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <p><strong>🔥 Top Spending Category:</strong> ${topCategory} (₹${topCategoryAmount})</p>
                        <p><strong>📅 Highest Spending Day:</strong> ${maxDay} (₹${maxDayAmount})</p>
                    </div>

                    <p style="text-align: center;">
                        <a href="https://penny-pilot-usoe.vercel.app/track" style="background-color: #B5b25C; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Detailed Analytics</a>
                    </p>
                </div>
             `;

            await sendEmail(user.email, "📅 Your Monthly Financial Report", htmlContent);
        }
    } catch (err) {
        console.error("Monthly report error:", err);
    }
});
app.get("/cron/send-daily-reminders", async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    const requestKey = req.query.key;

    // Security check
    if (!cronSecret || requestKey !== cronSecret) {
        console.warn("Unauthorized cron attempt detected.");
        return res.status(403).json({ error: "Unauthorized: Invalid or missing secret key" });
    }

    console.log("Running daily expense reminder job...");
    try {
        const result = await db.query("SELECT email FROM users");
        const users = result.rows;

        // FIRE AND FORGET: Do not await the emails.
        // Send response immediately so the cron job doesn't timeout.
        res.status(200).json({ message: "Daily reminders triggered. Emails are sending in the background via Brevo." });

        // Process emails in background
        users.forEach(async (user) => {
            if (!user.email) return;

            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
                    <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #4CAF50;">
                        <h1 style="color: #4CAF50; margin: 0;">PennyPilot</h1>
                        <p style="color: #666; font-size: 14px;">Your Personal Finance Assistant</p>
                    </div>
                    <div style="padding: 20px 0; text-align: center;">
                        <h2 style="color: #333;">Did you spend anything today?</h2>
                        <p style="font-size: 16px; color: #555; line-height: 1.5;">
                            Consistently tracking your expenses is the key to financial freedom. 
                            Take a moment to log your daily spending and keep your streak alive!
                        </p>
                        <a href="https://penny-pilot-usoe.vercel.app/login" 
                           style="display: inline-block; margin-top: 20px; padding: 12px 25px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                           Track Expenses Now
                        </a>
                    </div>
                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
                        <p>&copy; ${new Date().getFullYear()} PennyPilot. All rights reserved.</p>
                        <p>You received this email because you are a registered user of PennyPilot.</p>
                    </div>
                </div>
            `;

            await sendEmail(user.email, "🔔 Time to Track Your Expenses - PennyPilot", htmlContent);
        });

    } catch (err) {
        console.error("Error in reminder job:", err);
        if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/announce-profile", async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    const requestKey = req.query.key;

    // Security check
    if (!cronSecret || requestKey !== cronSecret) {
        console.warn("Unauthorized announcement attempt detected.");
        return res.status(403).json({ error: "Unauthorized: Invalid or missing secret key" });
    }

    console.log("Sending feature announcement emails...");
    try {
        const result = await db.query("SELECT email FROM users");
        const users = result.rows;

        // Send response immediately
        res.status(200).json({ message: "Feature announcement triggered. Emails are sending in the background." });

        users.forEach(async (user) => {
            if (!user.email) return;

            const htmlContent = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff; overflow: hidden;">
                    <div style="background-color: #2F4B26; padding: 30px 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">PennyPilot</h1>
                        <p style="color: #B5b25C; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Your Personal Finance Assistant</p>
                    </div>
                    <div style="padding: 40px 30px; text-align: center; color: #333333;">
                        <h2 style="color: #2F4B26; margin-top: 0;">🚀 New Feature Alert: Your Financial Profile!</h2>
                        <p style="font-size: 16px; line-height: 1.6; color: #555555; margin-bottom: 25px;">
                            We've upgraded your PennyPilot experience! You can now view your personalized financial profile to get a snapshot of your spending habits.
                        </p>
                        
                        <div style="background-color: #f4f7f2; border-left: 4px solid #B5b25C; padding: 20px; text-align: left; margin-bottom: 30px; border-radius: 4px;">
                            <h3 style="margin: 0 0 10px 0; color: #2F4B26;">What's New?</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #555;">
                                <li style="margin-bottom: 8px;">🔥 <strong>Streak Tracking:</strong> Keep your momentum going!</li>
                                <li style="margin-bottom: 8px;">💰 <strong>Total Expense Overview:</strong> See your lifetime spending at a glance.</li>
                                <li style="margin-bottom: 0;">📊 <strong>Top Category:</strong> Identify where most of your money goes.</li>
                            </ul>
                        </div>

                        <a href="https://penny-pilot-usoe.vercel.app/profile" 
                           style="display: inline-block; padding: 14px 30px; background-color: #B5b25C; color: white; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(181, 178, 92, 0.4); transition: transform 0.2s;">
                           Check My Profile
                        </a>
                    </div>
                    <div style="background-color: #2F4B26; padding: 20px; text-align: center; font-size: 12px; color: #a0c29a;">
                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} PennyPilot. All rights reserved.</p>
                        <p style="margin: 5px 0 0 0;">You are receiving this because you are a valued member of our community.</p>
                    </div>
                </div>
            `;

            await sendEmail(user.email, "🚀 Check out your new Financial Profile!", htmlContent);
        });

    } catch (err) {
        console.error("Error in announcement job:", err);
        if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/update-income", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/login");
    let income = req.body.income;
    if (income) {
        // Remove commas if present
        income = parseInt(income.toString().replace(/,/g, ""), 10);
        await db.query("UPDATE users SET monthly_income = $1 WHERE id = $2", [income, req.user.id]);
    }
    res.redirect("/profile");
});

export default app;

if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Server running on ${port}`);
    });
}