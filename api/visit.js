const { MongoClient, ObjectId } = require('mongodb');
require("string_score");

async function connectToDatabase(uri) {
  try {
    const client = await MongoClient.connect(uri, { useNewUrlParser: true })
    const db = await client.db('current')
    return db
  } catch (err) {
    throw new Error(`Error connecting to DB: ${err}`)
  }
}

module.exports = async (req, res) => {
  const db = await connectToDatabase(process.env.MONGODB_URI)

  // visitsCollection { _id<uId> (used as visitId), userId<string>, name<string> }
  const visitsCollection = await db.collection('visits')
  // usersCollection { _id<uId>, userId<string>, arrivalObjects<[{ visitId, userId, name }]> }
  const usersCollection = await db.collection('users')

  const { method } = req;
  if (method === 'POST') {
    const { userId, name } = req.body;
    if (!userId || !name) {
      return res.status(404).send({
        message: 'Invalid request, please specify userId and name in request body'
      });
    }
    const arrivalObject = { userId, name };
    let visitId;
    try {
      const newDocument = await visitsCollection.insertOne(arrivalObject);
      visitId = newDocument.insertedId;
      arrivalObject.visitId = visitId;
    } catch (err) {
      console.error('Error adding arrival object to visitsCollection: ', err);
      return res.status(500).send();
    }
    try {
      const userDocument = await usersCollection.findOne({ userId });
      if (!userDocument) {
        await usersCollection.insertOne({
          userId,
          arrivalObjects: [arrivalObject],
        })
      } else {
        const { arrivalObjects } = userDocument;
        arrivalObjects.push(arrivalObject);
        if (arrivalObjects.length > 5) {
          arrivalObjects.shift()
        }
        await usersCollection.findOneAndUpdate({ userId }, { $set: { arrivalObjects } }, { returnOriginal: false });
      }
      return res.status(200).json({ visitId })
    } catch (err) {
      console.error('Error adding arrival object to usersCollection: ', err);
      return res.status(500).send();
    }
  }

  if (method === 'GET') {
    const { visitId, userId, searchString } = req.query;
    if (visitId) {
      try {
        const visit = await visitsCollection.findOne({ "_id": ObjectId(visitId) })
        if (!visit) {
          return res.status(404).send({
            message: `No visit found for visitId: ${visitId}}`
          });
        }
        const arrivalObject = {
          userId: visit.userId,
          name: visit.name,
          visitId,
        }
        return res.status(200).json([arrivalObject])
      } catch (err) {
        console.error('Error finding visit from visitId: ', err);
        return res.status(500).send();
      }
    } else if (userId && searchString) {
      try {
        const userVisits = await usersCollection.findOne({ userId })
        if (!userVisits) {
          return res.status(404).send({
            message: `No user found for userId: ${userId}`
          });
        }
        const { arrivalObjects } = userVisits;
        const results = arrivalObjects.filter(({ name }) => searchString.score(name, 1) > 0.5);
        const matchedArrivalObjects = results.map(({ userId, name, visitId }) => ({ userId, name, visitId }))
        return res.status(200).json(matchedArrivalObjects)
      } catch (err) {
        console.error('Error finding visits from userId and searchString: ', err);
        return res.status(500).send();
      }
    } else {
      return res.status(404).send({
        message: `Invalid request, please specify unique visitId or userId and searchString`
      });
    }
  }

  return res.status(404).send({
    message: 'Invalid request, please either POST a valid visit or GET visit info with valid visitId or userId and searchString'
  });
}
