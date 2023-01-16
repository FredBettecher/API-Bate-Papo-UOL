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
    lastStatus: joi.string()
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid('message', 'private_message'),
    time: joi.string()
});

let dateNow = Date.now()
let date = dayjs(dateNow).format('HH:mm:ss');

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
            lastStatus: date
        });

        await db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: date
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
            time: date
        });

        res.sendStatus(201);

    } catch(err) {
        res.status(500).send(err.message);
    }
});

app.get(('/messages'), async(req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;
    
    if(parseInt(limit) > 0) {
        db.collection('messages').find().toArray().then(messagesList => {
            const messages = [];
            messagesList.map(message => {
                if(message.from === user || message.to === user || message.type === 'message' || message.type === 'status') {
                    messages.push(message);
                }
            });
            return res.send(messages.slice(parseInt(-limit)).reverse());
        });
    } else {
        db.collection('messages').find().toArray().then(messagesList => {
            const messages = [];
            messagesList.map(message => {
                if(message.from === user || message.to === user || message.type === 'message' || message.type === 'status') {
                    messages.push(message);
                }
            });
            return res.send(messages.reverse());
        });
    }
});

app.post(('/status'), (req, res) => {

});

app.listen(process.env.PORT, () => console.log("Online at port", process.env.PORT));