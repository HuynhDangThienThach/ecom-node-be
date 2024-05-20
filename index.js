const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { error } = require("console");
const { type } = require("os");
const stripe = require("stripe")("sk_test_51PA5zsEXMnr0TmR96Dw6UlHW9iuc6zCn6LrIch5XzdvktPUo3zlrAPF5cgmAN09cxsNBgeGdaIPsFATp803t8m8j005IeEPvqL");
app.use(express.json());
app.use(cors());

//--- Database Connection with MongoDB
mongoose.connect("mongodb+srv://thachlovedevv:Thach041203.@cluster0.bpsauxo.mongodb.net/e-commerce");

//---API Creation
app.get("/",(req,res)=>{
    res.send("Express App is Running")
})

//---Image Storage Engine
const storage = multer.diskStorage({
    // Xác định thư mục để lưu trữ hình ảnh được tải lên
    destination: './upload/images',
    filename: (req, file, cb) =>{
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
}); 

const upload = multer({storage:storage});

//---Creating upload endpoint for images
app.use('/images',express.static('upload/images'))
// Xác định tuyến POST để xử lý việc tải lên hình ảnh
app.post("/upload",upload.single('product'),(req, res) =>{
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
        // image_url: `http://${process.env.DOMAIN}:${port}/images/${req.file.filename}`
    })
})

//--- Schema for creating products
const Product = mongoose.model("Product",{
    id:{
        type: Number,
        required:true,
    },
    name:{
        type:String,
        required:true,
    },
    image:{
        type:String,
        required: true
    },
    category:{
        type: String,
        required: true,
    },
    new_price:{
        type:Number,
        required: true,
    },
    old_price:{
        type: Number,
        required: true,
    },
    date:{
        type:Date,
        default: Date.now,
    },
    avilable:{
        type: Boolean,
        default: true,
    },
})

//--- Add product to mongooseDB
app.post('/addproduct', async(req, res) =>{
    let products = await Product.find({});
    let id;
    if(products.length>0){
        //--- Láy sản phẩm cuối cùng trong ds
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id+1;
    }
    else{
        id = 1;
    }
    const product = new Product({
        id:id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price
    });
    console.log(product);
    await product.save();
    console.log("Saved");
    res.json({
        success:true,
        name:req.body.name,
    })
})

//--- Creating API for deleting products
app.post('/removeproduct', async (req,res) =>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed");
    res.json({
        success:true,
        name: req.body.name
    })
})
//--- Creating API for getting all products
app.get('/allproducts', async (req, res) =>{
    let products = await Product.find({});
    console.log("All Products Fetched");
    res.send(products);
})

//---Schema creating for user model
const Users = mongoose.model('Users',{
    name:{
        type:String,
    },
    email:{
        type:String,
        unique:true,
    },
    password:{
        type:String,
    },
    cartData:{
        type: Object,
    },
    date:{
        type:Date,
        default: Date.now,
    }
})


//---Creating Endpoint for registering the user
app.post('/signup', async (req, res) =>{
    //--- Kiểm tra email đã có trong db chưa
    let check = await Users.findOne({email:req.body.email});
    if(check){
        return res.status(400).json({success:false, errors:"existing user found with same email address"})
    }
    //--- Tạo người dùng mới 
    let cart ={};
    for (let i =0; i < 300; i ++){
        cart[i] = 0;
    }
    const user = new Users({
        name: req.body.username,
        email:req.body.email,
        password: req.body.password,
        cartData: cart,
    })

    await user.save();

    const data = {
        user:{
            id:user.id
        }
    }

    const token = jwt.sign(data, 'secret_ecom');
    res.json({success: true, token})

})

//--- Creating endpoint for user login
app.post('/login', async (req, res) =>{
    let user = await Users.findOne({email:req.body.email});
    if (user){
        const passCompare = req.body.password === user.password;
        if(passCompare){
            const data = {
                user: {
                    id: user.id
                }
            }
            const token = jwt.sign(data, 'secret_ecom');
            res.json({success:true, token});
        }
        else{
            res.json({success:false, errors: "Mật khẩu không chính xác"});
        }
    }
    else{
        res.json({success:false, erros: "Địa chỉ Email không chính xác"})
    }
})

//--- Creating endpoint for newcollection data
app.get('/newcollections', async (req, res) =>{
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("NewCollection Fetched");
    res.send(newcollection);
})

//--- Creating endpoint for popular in women section
app.get('/popularinwomen', async (req, res) =>{
    let products = await Product.find({category: "giadungbep"})
    let popular_in_women = products.slice(1).slice(-8);
    console.log("Popular in women fetched");
    res.send(popular_in_women);
})

//--- Creating middelware to fetch user
const fetchUser = async (req, res, next)=>{
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"Please authenticate using valid token"})
    }
    else{
        try{
            const data = jwt.verify(token, 'secret_ecom');
            req.user = data.user;
            next();
        }catch (error){
            res.status(401).send({error:"please authenticate using a valid token"})
        }
    }
}

//--- Creating endpoint for adding products in cartdata
app.post('/addtocart', fetchUser, async (req, res) =>{
    console.log("Added", req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({_id:req.user.id}, {cartData: userData.cartData});
    res.send("Added")
})

//--- Creating endpoint to remove product from cartdata
app.post('/removefromcart', fetchUser, async(req, res) =>{
    console.log("removed", req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({_id:req.user.id}, {cartData: userData.cartData});
    res.send("Removed")
})

// Creating endpoint to get cartdata
app.post('/getcart', fetchUser, async (req, res) =>{
    console.log("GetCart");
    let userData = await Users.findOne({_id: req.user.id})
    res.json(userData.cartData);
})

//---Schema creating for order model
const orderSchema = mongoose.model('Order',{
    userID:{type:String, require:true},
    items:{type:Array, require:true},
    amount:{type:Number, require:true},
    address:{type:Object, require: true},
    status:{type:String, default:"Processing"},
    date:{type: Date, default:Date.now()},
    payment:{type:Boolean, default: false}
})

// Creating endpoint to placeOrder
app.post('/place', async (req, res) =>{
    try{
        const newOrder = new orderSchema({
            userId: req.body.userId,
            items:req.body.items,
            amount:req.body.amount,
            address:req.body.address
        })
        await newOrder.save();
        await Users.findByIdAndUpdate(req.body.email,{cartData:{}});
        const items = req.body.items || []
        const line_items = items.map((item) => ({
            price_data: {
                currency: "vnd",
                product_data: {
                    name: item.name,
                },
                unit_amount: item.new_price* 1000,
          },
          quantity: item.quantity,
        }))

        line_items.push({
            price_data:{
                currency:"vnd",
                product_data:{
                    name:"Rỗng"
                },
                unit_amount: 0 
            },
            quantity:1
        })
        // process

        const session = await stripe.checkout.sessions.create({
            line_items:line_items,
            mode:'payment',
            success_url: "http://localhost:3000/success",
            cancel_url: "http://localhost:3000/cancel"
        })
        res.json({success:true, session_url: session.url})
    }catch (error){
        console.log(error);
        res.json({success:false,message:"backend Error"})
    }
})


app.listen(port, (error)=>{
    if(!error){
        console.log("Server Running on Port " + port)
    }
    else
    {
        console.log("Error :" +error)
    }
})