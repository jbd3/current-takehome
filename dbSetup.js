const { MongoClient } = require('mongodb');

const setupDb = async () => {
  const client = await MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true })
  const db = await client.db('current')

  db.createCollection("users", {
    validator:
    {
      $jsonSchema:
      {
        bsonType: "object",
        required: ["userId", "locationObjects"],
        properties:
        {
          _id: {},
          userId: {
            bsonType: ["string"],
            description: "valid userId string is required"
          },
          arrivalObjects: {
            bsonType: ["array"],
            minItems: 1,
            items: {
              bsonType: ["object"],
              required: ["name", "userId"],
              description: "arrivalObjects include location name and userId and visitId",
              properties:
              {
                _id: {},
                userId: {
                  bsonType: ["string"],
                },
                name: {
                  bsonType: ["string"],
                },
                visitId: {
                  bsonType: ["string"],
                }
              }
            }
          }
        }
      }
    }
  })
  db.createCollection("visits", {
    validator:
    {
      $jsonSchema:
      {
        bsonType: "object",
        required: ["userId", "name", "visitId"],
        properties:
        {
          _id: {},
          userId: {
            bsonType: ["string"],
            description: "valid userId string is required"
          },
          name: {
            bsonType: ["string"],
            description: "valid location name string is required"
          },
          visitId: {
            bsonType: ["string"],
            description: "valid visitId is required"
          },
        }
      }
    }
  })
}

setupDb();