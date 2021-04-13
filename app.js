const express = require("express");
const path = require("path");

const app = express();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

var customers = require("./Customers");
const Cloudant = require("@cloudant/cloudant");

cloudantConnect();

async function cloudantConnect() {
  console.log("Connecting to Cloudant...");

  try {
    const cloudant = Cloudant({
      url:
        "https://724cae9b-9239-4913-97e4-7e5c929b6b49-bluemix.cloudantnosqldb.appdomain.cloud",
      plugins: {
        iamauth: {
          iamApiKey: "r4-P2cSe8h8xZixmPE77U-5zIqMshr4w2PLu-D7Zkmo_",
          // iamApiKey: "TVgGBOhGLLqPlMWyTD4Yu7c96Sh4eGpajz1zKBiZu5wl",
        },
      },
    });
    console.log("Successfully Connected to Cloudant");

    try {
      var allDBs = await cloudant.db.list();
      // console.log(`List of Cloudent DBs : ${allDBs}`)

      if (allDBs.indexOf("customers") == -1) {
        cloudant.db.create("customers");

        var custo = cloudant.db.use("customers");
        await custo.insert({ customers });

        console.log(`Initiated 'customers' database Successfully`);
      } else {
        console.log(`Connecting to Database - customers...`);
        var custo = cloudant.db.use("customers");
        console.log(`Successfully Connected to Database - customers`);
      }

      //   Getting doc from customer DB :

      listOfDocs = await custo.list("customers", { include_docs: true });
      var docREV = await listOfDocs["rows"][0]["value"]["rev"];
      var docID = await listOfDocs["rows"][0]["id"];

      var tt = await custo.get(docID);
      customers = tt["customers"];

      console.log("BackEnd Microservice is ready to serve (•‿•)");

      app.get("/", (req, res) => {
        res.send("Home Page");
      });

      const idFilter = (req) => (member) => member.id === req.params.id;

      // Gets All customers
      app.get("/customers/", async (req, res) => res.json(customers));

      // Get Single Member
      app.get("/customers/:id", async (req, res) => {
        const found = customers.some(idFilter(req));
        console.log(found);
        console.log(typeof req.params.id);

        if (found) {
          res.json(customers.filter(idFilter(req)));
        } else {
          res
            .status(400)
            .json({ msg: `No member with the id of ${req.params.id}` });
        }
      });

      // Get Single Member
      app.get("/getBalance/:id", async (req, res) => {
        const found = customers.some(idFilter(req));
        console.log(found);
        console.log(typeof req.params.id);
        if (found) {
          var temp = customers.filter(idFilter(req));
          // res.json({"Balance" : temp[0]["balance"]});
          res.json(temp[0]["balance"]);
        } else {
          res
            .status(400)
            .json({ msg: `No member with the id of ${req.params.id}` });
        }
      });

      // login Member
      app.post("/login", async (req, res) => {
        const email = req.body.email;
        const password = req.body.password;
        console.log(email);
        console.log(password);
        const found = customers.some(
          (customer) =>
            JSON.stringify(customer.email) === JSON.stringify(email)
        );
        //console.log(customer);
        console.log(typeof(customers));
        console.log(customers.length);
        var bool1 = 0;
        var index = 0;
        for (i = 0; i < customers.length; i++) {
          if(customers[i].email == email && customers[i].password == password){
            bool1 = 1;
            index = i;
            break;
          }
        }
        if (bool1 == 1) {
            return res
            .status(200)
            .json(customers[index]);
          
          //console.log("hello");
        }

        if (!found) {
          return res.status(400).json({ msg: "Invalid Access" });
        }

      });

      // Create Member
      app.post("/customers/", async (req, res) => {
        const newMember = {
          ...req.body,
          balance: 0,
        };

        const found = customers.some(
          (customer) =>
            JSON.stringify(customer.id) === JSON.stringify(newMember.id)
        );

        if (found) {
          return res.status(400).json({ msg: "Already existing customer" });
        }

        if (!newMember.id) {
          return res.status(400).json({ msg: "Invalid Access" });
        }

        if (!newMember.name || !newMember.email) {
          return res
            .status(400)
            .json({ msg: "Please include a name and email" });
        }

        customers.push(newMember);
        res.json(customers);

        // res.redirect('/');
        console.log("Updating on Cloudant...");
        try {
          await custo.insert({
            _id: docID,
            _rev: docREV,
            customers,
          });
          console.log(docREV);
          listOfDocs = await custo.list("customers", { include_docs: true });
          docREV = await listOfDocs["rows"][0]["value"]["rev"];
          console.log(docREV);
        } catch (error) {
          console.log(`Database Updating Error : ${error}`);
        }
        console.log("Done");
      });

      // Add funds Member
      app.put("/addFunds/:id", async (req, res) => {
        const found = customers.some(idFilter(req));

        if (found) {
          customers.forEach((member, i) => {
            if (idFilter(req)(member)) {
              var updCustomer = { ...member, ...req.body };
              updCustomer["balance"] += customers[i]["balance"];
              customers[i] = updCustomer;
              res.json({ msg: "Funds updated successfully", updCustomer });
            }
          });
        } else {
          return res
            .status(400)
            .json({ msg: `No member with the id of ${req.params.id}` });
        }
        console.log(customers);

        try {
          console.log("Updating on Cloudant...");
          await custo.insert({
            _id: docID,
            _rev: docREV,
            customers,
          });
          console.log(docREV);
          listOfDocs = await custo.list("customers", { include_docs: true });
          docREV = await listOfDocs["rows"][0]["value"]["rev"];
          console.log(docREV);

          console.log("Done");
        } catch (error) {
          console.log(`Database Updating Error : ${error}`);
        }
      });

      // Update Member
      app.put("/customers/:id", async (req, res) => {
        const found = customers.some(idFilter(req));

        if (found) {
          customers.forEach((member, i) => {
            if (idFilter(req)(member)) {
              const updCustomer = { ...member, ...req.body };
              customers[i] = updCustomer;
              res.json({ msg: "Member updated", updCustomer });
            }
          });
        } else {
          return res
            .status(400)
            .json({ msg: `No member with the id of ${req.params.id}` });
        }

        // res.redirect('/');
        console.log(customers);

        try {
          console.log("Updating on Cloudant...");
          await custo.insert({
            _id: docID,
            _rev: docREV,
            customers,
          });
          console.log(docREV);
          listOfDocs = await custo.list("customers", { include_docs: true });
          docREV = await listOfDocs["rows"][0]["value"]["rev"];
          console.log(docREV);

          console.log("Done");
        } catch (error) {
          console.log(`Database Updating Error : ${error}`);
        }
      });

      // Delete Member
      app.delete("/customers/:id", async (req, res) => {
        const found = customers.some(idFilter(req));

        if (found) {
          customers = customers.filter((member) => !idFilter(req)(member));
          res.json({
            msg: "Member deleted",
            customers,
          });
        } else {
          res
            .status(400)
            .json({ msg: `No member with the id of ${req.params.id}` });
        }

        console.log("Updating on Cloudant...");
        try {
          await custo.insert({
            _id: docID,
            _rev: docREV,
            customers,
          });

          console.log(docREV);
          listOfDocs = await custo.list("customers", { include_docs: true });
          docREV = await listOfDocs["rows"][0]["value"]["rev"];
          console.log(docREV);
        } catch (error) {
          console.log(`Database Updating Error : ${error}`);
        }
        console.log("Done");
      });
    } catch (error) {
      console.log(`Database Error : ${error}`);
    }
  } catch (error) {
    console.log(`Cloudant Error : ${error}`);
  }
}

const PORT = process.env.PORT || 1234;
app.listen(PORT, () => console.log(`Backend Server started on port ${PORT}`));
