const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require("stripe")('sk_test_51NBJHPIdCHt5Pi0hCTlmkyFa2SrU5gX91gugug6TIDJPU93THzJzC09mlaeuW6JFEsCKCFLpB2BzF1dDuYSr4ndV00xOQW5mjW');



const app = express()
const port = process.env.PORT || 5000;



// !==================
//!middlewear
app.use(cors())
// app.use(express.static("public"));
app.use(express.json())



// !==================
//!mongodb credentials
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vfeao8o.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// ?==================




//!=========================================
//!Jwt function for verifying
function verifyJWT(req, res, next) {

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send('unauthorized access');
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'forbidden access' })
    }
    req.decoded = decoded;
    next();
  })

}




//!=========================================
//!main Database worksPlace
async function run() {
  try {


    // !====================================
    //!collection--DB
    const categoriesCollection = client.db('wood_sell').collection('categories');
    const productsCollection = client.db('wood_sell').collection('products');
    const itemsCollection = client.db('wood_sell').collection('items');
    const advertiseCollection = client.db('wood_sell').collection('advertise');
    const bookingsCollection = client.db('wood_sell').collection('bookings');
    const usersCollection = client.db('wood_sell').collection('users');
    const paymentsCollection = client.db('wood_sell').collection('payments');




    //!***
    //!=========================================
    //!All Categories
    app.get('/categories', async (req, res) => {
      const query = {};
      const cursor = categoriesCollection.find(query);
      const categories = await cursor.toArray();
      res.send(categories);
    })




    //!=========================================
    //!Single category
    app.get('/categories/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const result = await categoriesCollection.findOne(filter)
      res.send(result)
    })




    //*****************************************\\
    //* get and post api for Products----------!!
    //*****************************************\\
    //!All products get
    app.get('/products', async (req, res) => {
      const query = {};
      const cursor = productsCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    })



    //!=========================================
    //!All products get
    app.post('/products', async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    })
    //****************************************\\





    //*****************************************\\
    //* Email query api for Products-(My Sell Post)
    //*****************************************\\
    app.get('/mySellPost', verifyJWT, async (req, res) => {
      const email = req.query.email;

      // //!From JWT Function (only admin use so off it for public purposes)
      // const decodedEmail = req.decoded.email;
      // if (email !== decodedEmail) {
      //   return res.status(403).send({ message: 'forbidden access' });
      // }


      const query = { email: email };
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });
     //****************************************\\





    //!=========================================
    //!Single product by id
    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const product = await productsCollection.findOne(query);
      res.send(product)
    })


   

    //!=========================================
    //! product filter by category. 01,02,03,04 .
    app.get('/items/:id', async (req, res) => {
      const id = req.params.id;
      const query = { category_id: id }
      const category = await itemsCollection.find(query).toArray();
      res.send(category);
    })




    //!=========================================
    //!All advertise
    app.get('/advertise', async (req, res) => {
      const query = {};
      const cursor = advertiseCollection.find(query);
      const advertise = await cursor.toArray();
      res.send(advertise);
    })




    //!=========================================
    //!Single advertise by id
    app.get('/advertise/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const advertise = await advertiseCollection.findOne(query);
      res.send(advertise)
    })




    //!=========================================
    //!GET Api -Bookings , Dashboard, My Orders
    app.get('/bookings', verifyJWT, async (req, res) => {
      const email = req.query.email;

      
      // //!From JWT Function (only admin use so off it for public purposes)
      // const decodedEmail = req.decoded.email;
      // if (email !== decodedEmail) {
      //   return res.status(403).send({ message: 'forbidden access' });
      // }


      const query = { clientEmail: email }
      // console.log(query)
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    })




    //!=========================================
    //!Post Api -Bookings
    app.post('/bookings', async (req, res) => {
      const booking = req.body
      // console.log(booking);


      //!Limit Bookings
      //!Quary each email address is allow for one product.

      const query = {
        clientEmail: booking.clientEmail,
        productName: booking.productName
      }


      const alreadyBooked = await bookingsCollection.find(query).toArray();


      if (alreadyBooked.length) {
        const message = `You have already booked ${booking.productName}`
        return res.send({ acknowledged: false, message })
      }


      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    })




    // !====================================
    // !added payment intent api- Stripe
    app.post('/create-payment-intent', async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount: amount,
        "payment_method_types": [
          "card"
        ],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })




  // !====================================
  // !added payment post api- Stripe
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })





    // !====================================
    // !Get paymentList data  data (paid) get api- Stripe
    app.get('/payments', async (req, res) => {
      const query = {};
      const cursor = paymentsCollection.find(query);
      const payments = await cursor.toArray();
      res.send(payments);
    })




    //!=========================================
    // ! JWT for preventing multiple authorization  requests from one email address.
    app.get('/jwt', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' })
        return res.send({ accessToken: token });
      }
      console.log(user)
      res.status(403).send({ accessToken: 'Unauthorized Access' })
    });




    //!=========================================
    //!Get Api-Users.(NB: This is a open api, to be promoted by jwt and admin users.)
    app.get('/users', async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });




    //*****************************************\\
    //* Buyer query api for -(All Buyers)
    //*****************************************\\
    app.get('/role', async (req, res) => {
      const role = req.query.role;
      const query = { role: role };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
     //****************************************\\
    // http://localhost:5000/role?role=seller
    // http://localhost:5000/role?role=buyer
    // Learn more about the query parameters



    //!=========================================
    //!User admin investigation api , it is admin then it can make admin.
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email }
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === 'admin' });
    })



    //!=========================================
    //!Post Api-Users.(data send from client to save users into DB)
    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })



    //!=========================================
    //! Admin api make
    app.put('/users/admin/:id', verifyJWT, async (req, res) => {

      //!verifyJWT
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }


      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    })





    // !====================================
    // ! Category name project api - need just category name.(mongodb project some fields api) 
    app.get('/categoryName', async (req, res) => {
      const query = {}
      const result = await categoriesCollection.find(query).project({ name: 1 }).toArray();
      res.send(result);
    })



    
    //*****************************************************************\\
    //*--------------------------DELETE API ---------------------------!!
    //*****************************************************************\\
    // !====================================
    // ! Delete Api- products . (single product)
    app.delete('/products/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(filter);
      res.send(result);
    })



    // !====================================
    // ! Delete Api- products . (mySellPost)
    app.delete('/mySellPost/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(filter);
      res.send(result);
    })



    // !====================================
    // ! Delete Api- Payments . (payments list)
    app.delete('/payments/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await paymentsCollection.deleteOne(filter);
      res.send(result);
    })



    // !====================================
    // ! Delete Api- bookings . (myOrder)
    app.delete('/bookings/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(filter);
      res.send(result);
    })



    // !====================================
    // ! Delete Api- users . (allBuyer & allSeller)
    app.delete('/users/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    })

    //*****************************************************************\\
    //*-------------------------DELETE API END-------------------------!!
    //*****************************************************************\\



    // !====================================
    // !Temporary add.
    //! temporary to update mobile field on user options
    // ! It make a general field for all object of a collection. 
    app.get('/addMobile', async (req, res) => {
      const filter = {}
      const options = { upsert: true }
      const updatedDoc = {
        $set: {
          mobile: "01683476483"
        }
      }
      const result = await usersCollection.updateMany(filter, updatedDoc, options);
      res.send(result);
    })



    // !====================================
    //!Booking pament api for single id.
    app.get('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
    })


  }

  finally {

  }
}

run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Wood Sell is running on Server")
});


//! cmd showed window--
app.listen(port, () => {
  console.log(`Wood Sell is running on port: ${port}`);
});


//************************************************** */
//!  ************************************************\\
//*                  This is the End                *//
//!  ************************************************\\
//*                     Thank you                   *//
//!  ************************************************\\