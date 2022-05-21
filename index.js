const express = require('express');
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const res = require('express/lib/response');

app.use(cors())
app.use(express.json())
const port = process.env.PORT || 5000;



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p7ucf.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

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
        // get user using put method
        app.put('/user:email', async () => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.findOne(filter, updateDoc, options)
            res.send(result)
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
        app.get('/booking', async (req, res) => {
            const patientEmail = req.query.patientEmail
            const query = { patientEmail: patientEmail }
            console.log(query);
            const bookings = await bookingCollection.find(query).toArray()
            res.send(bookings)
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

    }
    finally {

    }

}
run().catch(console.dir)


app.listen(port, () => {
    console.log('The Port is listening', port);
})
