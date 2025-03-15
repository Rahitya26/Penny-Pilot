import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import bcrypt from "bcrypt";
import pg from "pg";
import passport from "passport";
import env from "dotenv";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";

const port = 3000;
const app = express();
env.config();
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));

const db = new pg.Client({
    user : process.env.PG_USER,
    host : process.env.PG_HOST,
    database : process.env.PG_DATABASE,
    password : process.env.PG_PASSWORD,
    port : process.env.PG_PORT,
})

db.connect();

app.use(session({
    secret : process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
}))
app.use(passport.initialize());
app.use(passport.session());


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
    res.render("signup.ejs");
});

app.get("/login",(req,res)=>{
    res.render("login.ejs");
});

app.get("/track",async(req,res)=>{
    if(req.isAuthenticated()){
let result = await db.query(`
    select date_trunc('day',add_date) as week,sum(amount) as total
    from expenses
    where user_name = $1
    group by week
    order by week`,[req.user.email]);
    console.log(result.rows);
    let label = result.rows.map(row => row.week.toISOString().split("T")[0]);
    let data = result.rows.map(row => row.total);
    console.log(label);
    console.log(data);
    let chartUrl = "https://quickchart.io/chart?c=" + encodeURIComponent(JSON.stringify({
        type:"radar",
        data:{
            labels:label,
            datasets:[{
                label : "Amount",
                data : data,
                backgroundColor : "red",
            }]
        }
    }));
    console.log(chartUrl);
    res.render("track.ejs",{chartUrl});
}
else{
    res.redirect("/login");
}
});

app.post("/signup",async(req,res)=>{
    let email = req.body.email;
    let password = req.body.password;
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

app.post("/login",passport.authenticate("local",{
    successRedirect:"/update",
    failureRedirect:"/login",
}))


app.post("/update",async (req,res)=>{
    let amount = parseInt(req.body.amount.replace(/,/g,""),10);
    let category = req.body.category;
    let date = req.body.date;
    let notes = req.body.notes;
    if(req.isAuthenticated())
    {
        const result = await db.query("INSERT INTO expenses(amount,category,add_date,notes,user_name) VALUES($1,$2,$3,$4,$5) RETURNING *",[amount,category,date,notes,req.user.email]);
        let streak = await db.query(`
            UPDATE users
            SET 
            last_update = CURRENT_DATE,
            update_streak = CASE
            WHEN last_update = CURRENT_DATE - INTERVAL '1 day' THEN update_streak+1
            WHEN last_update = CURRENT_DATE THEN update_streak
            ELSE 1
            END
            WHERE email = $1
            RETURNING * 
            `,[req.user.email]);
            console.log(streak.rows);
        console.log(streak.rows);
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
        return cb(null,false);
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
            return cb(null,false);
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