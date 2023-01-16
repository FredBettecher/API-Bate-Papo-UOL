import express  from "express";
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from "mongodb";
import joi from 'joi';
import dayjs from "dayjs";

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
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid('message', 'private_message'),
    time: joi.date()
});

const date = dayjs();

app.post(('/participants'), async(req, res) => {
    const { name } = req.body;
    const nameValidation = participantSchema.validate({ name });

    try {
        const resp = await db.collection('participants').findOne({ name });

        if(resp) {
            return res.status(409).send("Nome de usuário já cadastrado.");
        } else if(nameValidation.error) {
            return res.status(422).send(nameValidation.error.details);
        }
    
        await db.collection('participants').insertOne({
            name,
            lastStatus: Date.now()
        });

        await db.collection('login').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: `${date.hour}:${date.minute}:${date.second}`
        })

        res.sendStatus(201);

    } catch(err) {
        res.status(500).send(err.message);
    }
});

app.get(('/participants'), (req, res) => {
    db.collection('participants').find().toArray().then(participantsList => {
        return res.send(participantsList);
    })
});

app.post(('/messages'), async (req, res) => {
    const { user } = req.headers;
    const { from, to, text, type } = req.body;
    const messageValidation = messageSchema.validate({ to, text, type });

    try {
        const resp = await db.collection('participants').findOne({ from });

        if(messageValidation.error) {
            return res.status(422).send('Algo de errado não está certo.')
        } else if(!resp) {
            return res.status(422).send('Nome de usuário não encontrado.')
        }

        await db.collection('messages').insertOne({
            from: user,
            to,
            text,
            type,
            time: `${date.hour}:${date.minute}:${date.second}`
        });

    } catch(err) {
        res.status(500).send(err.message);
    }
});

app.get(('/messages'), (req, res) => {
    const { limit } = req.query;
    
    if(parseInt(limit) > 0) {
        db.collection('messages').find().toArray().then(messagesList => {
            const lastMessages = messagesList.slice(parseInt(-limit)).reverse();
            return res.send(lastMessages);
        });
    } else {
        db.collection('messages').find().toArray().then(messagesList => {
            return res.send(messagesList);
        });
    }
});

app.listen(process.env.PORT, () => console.log("Online at port", process.env.PORT));