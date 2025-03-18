import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import bcrypt from "bcrypt";
import pg from "pg";
import passport from "passport";
import env from "dotenv";
import { Strategy } from "passport-local";
import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";
import flash from "connect-flash";

const port = 3000;
const app = express();
env.config();
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.json());

const db = new pg.Pool({
    connectionString : process.env.DATABASE_URL,
    ssl:{
        rejectUnauthorized: false,
    }
})

db.connect().then(()=>console.log("Connected to db")).catch((err)=>console.log("Error connecting to db",err));

app.use(session({
    secret : process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
}))
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use((req, res, next) => {
    res.locals.error = req.flash("error"); 
    next();
});

app.get("/",(req,res)=>{
    res.render("index.ejs");
});
app.get("/update",(req,res)=>{
    if(req.isAuthenticated())
    {
        let message = req.session.message;
        req.session.message = null;
        res.render("update.ejs",{message});
    }
    else{
        res.redirect("/login");
    }
});

app.get("/signup",(req,res)=>{
    res.render("signup.ejs",{error : req.session.error});
    req.session.error = null;
});

app.get("/login",(req,res)=>{
    res.render("login.ejs");
});

app.get("/track",async(req,res)=>{
    if(req.isAuthenticated()){
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
          let titleIndex = Math.floor(Math.random()*titles.length);
          let tipIndex = Math.floor(Math.random()*tips.length);
          let title = titles[titleIndex];
          let tip = tips[tipIndex];
    let contRes = await db.query(`SELECT users.update_streak , SUM(expenses.amount) AS total, expenses.category
        FROM expenses
        INNER JOIN users ON expenses.user_id = users.id
        WHERE expenses.user_name = $1
        GROUP BY users.update_streak , expenses.category
        ORDER BY total DESC`,[req.user.email]);
        let streak = 0;
        let mostSpentCategory= "No category available";
        if(contRes.rows.length>0){
         streak = contRes.rows[0].update_streak;
         mostSpentCategory = contRes.rows[0].category;
        }
    let result = await db.query(`
    select sum(amount) as total,category
    from expenses
    where user_name = $1
    group by category`,[req.user.email]);
    let label = result.rows.map(row => row.category);
    let data = result.rows.map(row => row.total);
    if(label.length==0){
        label = ["No data"],
        data = [0];
    }
    let chartUrl = "https://quickchart.io/chart?c=" + encodeURIComponent(JSON.stringify({
        type:"line",
        data:{
            labels:label,
            datasets:[{
                label : "Amount",
                data : data,
                backgroundColor : "rgba(255, 0, 0,0.2)",
            }]
        }
    }));
    req.user.streak = streak;
    req.user.mostSpentCategory = mostSpentCategory;
    req.user.tip = tip;
    req.user.title = title;
    res.render("track.ejs",{
            chartUrl,
            streak,
            mostSpentCategory,
            tip,
            title,
    });
}
else{
    res.redirect("/login");
}
});

app.get("/logout",(req,res)=>{
    req.logout(err=>{
        if(err){
            console.error("Error is:");
        }
        else{
            res.redirect("/");
        }
    })
});

app.post("/track",async (req,res)=>{
    if(req.isAuthenticated()){
    let type = req.body.type;
    let qry;
    switch(type){
        case "bar" : qry = "SELECT add_date,SUM(amount) AS total FROM expenses WHERE user_name = $1 GROUP BY add_date";
        break;

        case "line" : qry = "SELECT DATE_TRUNC('week',add_date) AS week,SUM(amount) AS total FROM expenses WHERE user_name=$1 GROUP BY week";
        break;

        case "pie" : qry = "SELECT SUM(amount) AS total, category FROM expenses WHERE user_name = $1 GROUP BY category ORDER BY category";
        break;

        case "radar" : qry ="SELECT SUM(amount) AS total, category FROM expenses WHERE user_name = $1 GROUP BY category ORDER BY category";
        break;
    }
    const result = await db.query(qry,[req.user.email]);
    let baseUrl = "https://quickchart.io/chart?c=";
    let chartUrl,label,data;
    switch(type){
        case "bar": label = result.rows.map(row => row.add_date.toISOString().split("T")[0]);
         data = result.rows.map(row => row.total);
        chartUrl = baseUrl + encodeURIComponent(JSON.stringify({
            type : "bar",
            data:{
                labels:label,
                datasets:[{
                    label:"Expenses",
                    backgroundColor:"rgba(85, 107, 47,0.8)",
                    data:data,
                }]
            }
        }));
        break;
        case "line":label = result.rows.map(row => row.week.toISOString().split("T")[0]);
        data = result.rows.map(row => row.total);
        chartUrl = baseUrl + encodeURIComponent(JSON.stringify({
            type:"line",
            data:{
                labels:label,
                datasets:[{
                    label : "Expenses",
                    backgroundColor:"rgba(85,107,47,0.2)",
                    borderColor:"rgba(85,107,47,1)",
                    data:data,
                }]
            }
        }));
        break;
        case "pie" : label = result.rows.map(row => row.category);
        data = result.rows.map(row => row.total);
        chartUrl = baseUrl + encodeURIComponent(JSON.stringify({
            type : "outlabeledPie",
            data:{
                labels:label,
                datasets:[{
                    backgroundColor:["rgba(85,107,47,1)","rgba(103, 107, 47, 1)","rgba(47, 107, 89, 1)","rgba(107, 59, 47, 1)","rgba(107, 47, 104, 1)"],
                    data:data,
                }]
            },
            "options":{
                "plugins":{
                    "outlabels":{
                        "textcolor":"white",
                    }
                }
            }
        }));
        break;
        case "radar" : label = result.rows.map(row => row.category);
        data = result.rows.map(row => row.total);
        chartUrl = baseUrl + encodeURIComponent(JSON.stringify({
            type:"radar",
            data:{
                labels:label,
                datasets:[{
                    label:"Expenses",
                    data:data,
                }]
            }
        }));
        break;

    }
    res.render("track.ejs",{chartUrl,
        mostSpentCategory : req.user.mostSpentCategory,
        streak : req.user.streak,
        tip : req.user.tip,
        title : req.user.title,
    });
}
else{
    res.redirect("/login");
}
});

app.post("/verify",async (req,res)=>{
    let user_email = req.body.otp_email;
    let otp = await otpGenerator.generate(6,{
        upperCaseAlphabets:false,
        specialChars:false,
    });
    req.session.otp_generated = otp;
    console.log(req.session.otp_generated);
    const transporter = nodemailer.createTransport({
        service:"gmail",
        auth:{
            user : process.env.EMAIL_USERNAME,
            pass : process.env.PASS,
        }
    });
    
    transporter.sendMail({
        from:process.env.USERNAME,
        to:user_email,
        subject:"Authentication Email",
        html:`<h1>OTP for registration is</h1><br><h3>${otp}</h3>`
    },(err,info)=>{
        if(err)
        {
            console.log("Error in sending mail",err);
            return res.json({msg : "Email address doesn't exisit"});
        }
        else{
            console.log("Email send:",info.response);
            return res.json({msg:"OTP sent successfully"});
        }
    });

});

app.post("/signup",async(req,res)=>{
    let email = req.body.email;
    let password = req.body.password;
    let otp_entered = req.body.otp;
    console.log(otp_entered);
    if(!req.session.otp_generated || otp_entered !== req.session.otp_generated){
        req.session.error = "Wrong OTP. Please try again";
        return res.redirect("/signup");
    }
    let checkRes = await db.query("SELECT * FROM users WHERE email = $1",[email]);
    if(checkRes.rows.length == 0){
        let hash = await bcrypt.hash(password,10);
        let result = await db.query("INSERT INTO users (email,password) VALUES($1,$2) RETURNING *",[email,hash]);
        let user = result.rows[0];
        req.login(user,(err)=>{
            if(err)
                console.error("Error is:",err);
            res.redirect("/update");
        });
    }
    else{
        let user = checkRes.rows[0];
        req.login(user,(err)=>{
            if(err)
                console.error("Error is :",err);
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


app.post("/update",async (req,res)=>{
    let amount = parseInt(req.body.amount.replace(/,/g,""),10);
    let category = req.body.category;
    let date = req.body.date;
    let notes = req.body.notes;
    if(req.isAuthenticated())
    {
        const idRes = await db.query(`SELECT id FROM users WHERE email = $1`,[req.user.email]);
        let id = idRes.rows[0].id;
        const result = await db.query("INSERT INTO expenses(amount,category,add_date,notes,user_name,user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[amount,category,date,notes,req.user.email,id]);
        let streak = await db.query(`
            UPDATE users
            SET 
            update_streak = CASE
            WHEN last_update IS NULL THEN 1
            WHEN last_update = CURRENT_DATE - INTERVAL '1 day' THEN update_streak+1
            WHEN last_update < CURRENT_DATE - INTERVAL '1 day' THEN 1
            ELSE update_streak
            END,
            last_update = CURRENT_DATE
            WHERE email = $1
            RETURNING * 
            `,[req.user.email]);
        req.session.message = "Expenses added successfully!";

        res.redirect("/update");
    }
    else{
        res.redirect("/signup");
    }
});


passport.use("local",new Strategy(async function verify(username,password,cb){
    try{
    const checkRes = await db.query("SELECT * FROM users WHERE email = $1",[username]);
    if(checkRes.rows.length === 0){
        console.log("No user found");
        return cb(null,false,{message : "No user found with this email"});
    }
    else{
        let user = checkRes.rows[0];
        let valid = await bcrypt.compare(password,user.password);
        if(valid){
            console.log("Passwords matched");
            return cb(null,user);
        }
        else{
            console.log("Passwords not matched");
            return cb(null,false,{message : "Passwords doesn't match"});
        }
    }
}
catch(err){
    console.log("Verification error");
    console.error("Error:",err);
    return cb(err);
}
}));

passport.serializeUser((user,cb)=>{
    return cb(null,user);
});
passport.deserializeUser((user,cb)=>{
    return cb(null,user);
});

app.listen(port,()=>{
    console.log(`Server is running on http://localhost:${port}`);
});