const express = require('express');
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const res = require('express/lib/response');
app.use(cors())
app.use(express.json())
const port = process.env.PORT || 5000;



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p7ucf.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorize Person' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send('forbidden access');
        }
        req.decoded = decoded;
        next()
    });

}

async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("bookings");
        const userCollection = client.db("doctors_portal").collection("user");
        // Get All Service from database
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray()
            res.send(services)
        })
        // get all users
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })

        })
        // create Admin
        app.put('/user/admin/:email', async (req, res) => {
            const email = req.params.email;
            const requester = req.params.email;
            const requesterEmail = await userCollection.findOne({ email: requester })
            if (requesterEmail.role === 'admin') {

                const filter = { email: email }
                const updateDoc = {
                    $set: { role: 'admin' },
                }
                const result = await userCollection.updateOne(filter, updateDoc)
                console.log(result);
                res.send(result)
            }
            else {
                res.status(403).send('Forbidden')
            }
        })
        // get user using put method
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ result, token: token })
        })
        // get all available services
        app.get('/available', async (req, res) => {
            const date = req.query.treatmentDate;
            const services = await servicesCollection.find().toArray();
            const query = { treatmentDate: date }
            const bookings = await bookingCollection.find(query).toArray()
            services.forEach(service => {
                const bookingsService = bookings.filter(b => b.treatmentName === service.name);
                const booked = bookingsService.map(b => b.slot)
                const available = service.slots.filter(s => !booked.includes(s))
                service.slots = available
            })
            res.send(services)
        })
        // get all appointment
        app.get('/booking', verifyJWT, async (req, res) => {
            const patientEmail = req.query.patientEmail
            const authorization = req.headers.authorization;
            const decodedEmail = req.decoded?.email;
            if (patientEmail === decodedEmail) {
                const query = { patientEmail: patientEmail }

                const bookings = await bookingCollection.find(query).toArray()
                return res.send(bookings)
            }
            else {
                res.status(403).send({ message: 'Forbidden access' })
            }
        })
        // Post a Booking
        app.post('/booking', async (req, res) => {
            const bookingData = req.body;
            const query = { treatmentName: bookingData.treatmentName, treatmentDate: bookingData.treatmentDate, patientEmail: bookingData.patientEmail }
            const exist = await bookingCollection.findOne(query);
            if (exist) {
                return res.send({ success: false, bookingData: exist })
            }
            const result = await bookingCollection.insertOne(bookingData);
            res.send({ success: true, result });

        })
        app.get('/', async (req, res) => {
            res.send('Hello world')
        })

    }
    finally {

    }

}
run().catch(console.dir)


app.listen(port, () => {
    console.log('The Port is listening', port);
})
