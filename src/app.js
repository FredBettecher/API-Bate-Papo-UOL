import express  from "express";
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from "mongodb";
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
    time: joi.string()
});

app.post(('/participants'), async(req, res) => {
    const { name } = req.body;
    const nameValidation = participantSchema.validate({ name });
    const dateNow = Date.now()
    const date = dayjs(dateNow).format('HH:mm:ss');

    try {
        const resp = await db.collection('participants').findOne({ name });

        if(resp) {
            return res.status(409).send("Nome de usuário já cadastrado.");
        } else if(nameValidation.error) {
            return res.status(422).send(nameValidation.error.details);
        }
    
        await db.collection('participants').insertOne({
            name,
            lastStatus: dateNow
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
    const dateNow = Date.now()
    const date = dayjs(dateNow).format('HH:mm:ss');

    try {
        const resp = await db.collection('participants').findOne({ name: user });

        if(messageValidation.error) {
            return res.status(422).send('Algo de errado não está certo.')
        }
        
        if(!resp) {
            return res.status(422).send('Nome de usuário não encontrado.')
        }

        await db.collection('messages').insertOne({
            from: user,
            to,
            text,
            type,
            time: date
        });
        
        return res.sendStatus(201);

    } catch(err) {
        res.status(500).send(err.message);
    }
});

app.get(('/messages'), async(req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;

    try {
        if(limit <= 0 || typeof({ limit }) === 'string') {
            return res.sendStatus(422);
        } else if(Number(limit) > 0) {
            await db.collection('messages').find().toArray().then(messagesList => {
                const messages = [];
                messagesList.map(message => {
                    if(message.from === user || message.to === user || message.type === 'message' || message.type === 'status') {
                        messages.push(message);
                    }
                });
                return res.send(messages.slice(parseInt(-limit)).reverse());
            });
        } else {
            await db.collection('messages').find().toArray().then(messagesList => {
                const messages = [];
                messagesList.map(message => {
                    if(message.from === user || message.to === user || message.type === 'message' || message.type === 'status') {
                        messages.push(message);
                    }
                });
                return res.send(messages.reverse());
            });
        }

    } catch(err) {
        res.status(500).send(err.message);
    }
    
});

app.post(('/status'), async(req, res) => {
    const { user } = req.headers;
    const dateNow = Date.now();

    try {
        const participants = await db.collection('participants').find().toArray();

        if(participants.length > 0) {
            for(let i = 0; i<participants.length; i++) {
                if(participants[i].name.includes(user)){
                    await db.collection('participants').updateOne({name: user}, {$set: { lastStatus: dateNow } });
                    return res.sendStatus(200);
                }
            }
        }
        
        return res.status(404).send("Nome de usuário não encontrado.");

    } catch(err) {
        res.status(500).send(err.message);
    }
});

setInterval(async () => {
    const inactiveTime = Date.now() - 10000;

    try {
        const inactivesParticipants = await db.collection('participants').find({ lastStatus: { $lt: inactiveTime } }).toArray();

        if (inactivesParticipants.length > 0) {
            for (let i = 0; i < inactivesParticipants.length; i++) {
                await db.collection('messages').insertOne({
                    from: inactivesParticipants[i].name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs(Date.now()).format('HH:mm:ss')
                });

                await db.collection('participants').deleteOne({ name: inactivesParticipants[i].name });
            }
        }

    } catch (err) {
        console.log(err.message);
    }

}, 15000);

app.listen(process.env.PORT, () => console.log("Online at port", process.env.PORT));