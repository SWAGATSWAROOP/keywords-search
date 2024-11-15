const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");

const app = express();

app.use(express.json());

app.get("/getkeyword", async (req, res) => {
  try {
    const { message } = req.query;
    console.log(message);
    let data = JSON.stringify({ q: message, num: "10" });
    const serp_api = process.env.SERP_API_PERPLEXITY;
    console.log(serp_api);

    let config = {
      method: "post",
      url: "https://google.serper.dev/images",
      headers: {
        "X-API-KEY": serp_api,
        "Content-Type": "application/json",
      },
      data: data,
    };
    console.log("Making request to Serper...");
    const response = await axios(config);
    console.log("Request completed to Serper");

    // Extract all domains from the images array
    const domains = response.data.images.map((image) => image.domain);

    // Remove duplicates (optional)
    const uniqueDomains = [...new Set(domains)];

    // Prepare parallel requests
    const keywordApiKey = process.env.KEYWORD_API;
    const requests = uniqueDomains.map((domain) =>
      axios.get("https://api.semrush.com/", {
        params: {
          type: "domain_organic",
          key: keywordApiKey,
          display_filter: "",
          display_limit: 10,
          export_columns: "Ph,Po,Pp,Pd,Nq,Cp,Ur,Tr,Tc,Co,Nr,Td",
          domain: domain,
          display_sort: "tr_desc",
          database: "us",
        },
      })
    );

    // Execute all requests in parallel
    const responses = await Promise.all(requests);

    // Process responses (convert CSV to JSON and extract keywords)
    const csvToJson = (csvString) => {
      const rows = csvString.trim().split("\n");
      const headers = rows[0].split(";");
      return rows.slice(1).map((row) => {
        const values = row.split(";");
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index];
        });
        return obj;
      });
    };

    // Extract keywords from each response
    const allKeywords = responses.flatMap((response) => {
      const csvString = response.data;
      const json = csvToJson(csvString);
      return json.map((entry) => entry.Keyword);
    });

    return res.status(200).json({ message: allKeywords });
  } catch (error) {
    console.log("Server Error");
    return res.status(500).json({ message: "Failed" });
  }
});

app.listen(3000, () => {
  console.log("Server Listening on port 3000");
});
