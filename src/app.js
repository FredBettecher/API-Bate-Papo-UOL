import express  from "express";
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from "mongodb";
import joi from 'joi';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

try {
    await mongoClient.connect();
    db = mongoClient.db();
} catch(err) {
    console.log(err);
}

const participantSchema = joi.object({
    name: joi.string().required(),
    lastStatus: joi.number()
});

const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required(),
    time: joi.string().required()
});

app.post(('/participants'), async(req, res) => {
    const { name } = req.body;
    const nameValidation = participantSchema.validate({ name });

    try {
        const resp = await db.collection('participants').findOne({ name });

        if(resp) {
            return res.status(409).send("Nome de usuário já cadastrado.");
        }else if(nameValidation.error) {
            return res.status(422).send(nameValidation.error.details);
        }
    
        await db.collection('participants').insertOne({
            name,
            lastStatus: Date.now()
        });
        
        return res.sendStatus(201);

    } catch(err) {
        console.log(err)
        res.status(500).send(err.message);
    }
    
});

app.get(('/participants'), (req, res) => {
    db.collection('participants').find().toArray().then(participantsList => {
        return res.send(participantsList);
    })
});



app.listen(process.env.PORT, () => console.log("Online at port", process.env.PORT));