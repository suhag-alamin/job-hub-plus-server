const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
require("dotenv").config();

const app = express();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// mongodb connection uri

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qow90.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    const database = client.db("jobHubPlus");
    const userCollection = database.collection("users");
    const jobCollection = database.collection("jobs");
    const appliedJobCollection = database.collection("appliedJobs");

    // create user
    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);

      res.send(result);
    });

    // get user by email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });

      if (result?.email) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    // app.patch("/apply", async (req, res) => {
    //   const userId = req.body.userId;
    //   const jobId = req.body.jobId;
    //   const email = req.body.email;

    //   const filter = { _id: ObjectId(jobId) };
    //   const updateDoc = {
    //     $push: { applicants: { id: ObjectId(userId), email } },
    //   };

    //   const result = await jobCollection.updateOne(filter, updateDoc);

    //   if (result.acknowledged) {
    //     return res.send({ status: true, data: result });
    //   }

    //   res.send({ status: false });
    // });

    app.patch("/query", async (req, res) => {
      const userId = req.body.userId;
      const jobId = req.body.jobId;
      const email = req.body.email;
      const question = req.body.question;

      const filter = { _id: ObjectId(jobId) };
      const updateDoc = {
        $push: {
          queries: {
            id: ObjectId(userId),
            email,
            question: question,
            reply: [],
          },
        },
      };

      const result = await jobCollection.updateOne(filter, updateDoc);

      if (result?.acknowledged) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.patch("/reply", async (req, res) => {
      const userId = req.body.userId;
      const reply = req.body.reply;
      console.log(reply);
      console.log(userId);

      const filter = { "queries.id": ObjectId(userId) };

      const updateDoc = {
        $push: {
          "queries.$[user].reply": reply,
        },
      };
      const arrayFilter = {
        arrayFilters: [{ "user.id": ObjectId(userId) }],
      };

      const result = await jobCollection.updateOne(
        filter,
        updateDoc,
        arrayFilter
      );
      if (result.acknowledged) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    // get all jobs
    app.get("/jobs", async (req, res) => {
      const cursor = jobCollection.find({});
      const result = await cursor.toArray();
      res.send({ status: true, data: result });
    });

    // get job by id
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;

      const result = await jobCollection.findOne({ _id: ObjectId(id) });
      res.send({ status: true, data: result });
    });

    // search jobs

    app.post("/search-jobs", async (req, res) => {
      const { searchTerm } = req.query;

      const searchCriteria = {
        $or: [
          { position: { $regex: searchTerm, $options: "i" } },
          { companyName: { $regex: searchTerm, $options: "i" } },
          {
            skills: {
              $elemMatch: {
                $regex: searchTerm,
                $options: "i",
              },
            },
          },
        ],
      };

      try {
        const searchResults = await jobCollection
          .find(searchCriteria)
          .toArray();
        res.json({ status: true, data: searchResults });
      } catch (error) {
        console.error("Error searching jobs:", error);
        res
          .status(500)
          .json({ status: false, message: "Internal server error" });
      }
    });

    // post job
    app.post("/job", async (req, res) => {
      const job = req.body;

      const result = await jobCollection.insertOne(job);

      res.send({ status: true, data: result });
    });

    // delete or cancel posted job
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await jobCollection.deleteOne(query);
      res.send({ status: true, data: result });
    });

    // apply for job
    app.post("/apply", async (req, res) => {
      const applicantData = req.body;
      const jobId = req.body.jobId;
      const userId = req.body.userId;

      // check if the job exists in job collection
      const job = await jobCollection.findOne({ _id: ObjectId(jobId) });

      if (!job) {
        return res
          .status(404)
          .send({ status: false, message: "Job not found" });
      }

      // Update the applicants field in jobCollection
      const updateResult = await jobCollection.updateOne(
        { _id: ObjectId(jobId) },
        { $addToSet: { applicants: userId } }
      );

      // Insert the applicant data into appliedJobCollection
      const insertResult = await appliedJobCollection.insertOne(applicantData);

      res.send({ status: true, data: insertResult });
    });
    // get job by email
    app.get("/applied-jobs/:email", async (req, res) => {
      const email = req.params.email;
      const query = { candidateEmail: email };
      const cursor = appliedJobCollection.find(query);
      const result = await cursor.toArray();
      res.send({ status: true, data: result });
    });

    app.get("/posted-jobs/:email", async (req, res) => {
      const email = req.params.email;
      const query = { employerEmail: email };
      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.send({ status: true, data: result });
    });
    // delete or cancel a applied job
    app.delete("/cancel-applied-job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await appliedJobCollection.deleteOne(query);
      res.send({ status: true, data: result });
    });

    // get jobs by userIds and jobId
    app.post("/applicants", async (req, res) => {
      const applicants = req.body.applicants;
      const jobId = req.body.jobId;

      // Construct a query to match both the job ID and user IDs $and operator
      const query = {
        jobId: jobId,
        userId: { $in: applicants },
      };

      const cursor = appliedJobCollection.find(query);
      const result = await cursor.toArray();
      res.send({ status: true, data: result });
    });
  } finally {
  }
};

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("JobHubPlus Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
