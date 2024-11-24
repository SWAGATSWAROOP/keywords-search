const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");
const cheerio = require("cheerio");

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
    console.log(responses);

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
      return json;
    });

    return res.status(200).json({ message: allKeywords });
  } catch (error) {
    console.log("Server Error");
    return res.status(500).json({ message: "Failed" });
  }
});

app.post("/generatecontent", async (req, res) => {
  try {
    const arrayKeyword = req.body.keywords;
    const joinedString = arrayKeyword.join(" ");
    // console.log(joinedString);
    // console.log(process.env.ondemand_api_key);

    async function getChatSession() {
      const options = {
        method: "POST",
        url: "https://api.on-demand.io/chat/v1/sessions",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          apikey: process.env.ondemand_api_key,
        },
        data: {
          externalUserId: "HackBrokers",
        },
      };

      const response = await axios(options);
      return response?.data?.data?.id;
    }

    const getNewsChat = async (arrayKeyword) => {
      const sessionid = await getChatSession();
      console.log(sessionid);

      const options = {
        method: "POST",
        url: `https://api.on-demand.io/chat/v1/sessions/${sessionid}/query`,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          apikey: process.env.ondemand_api_key,
        },
        data: {
          responseMode: "sync",
          query: `Provide 1500 word article on ${arrayKeyword} which is SEO friendly`,
          onlyFulfillment: true,
          endpointId: "predefined-openai-gpt4o",
        },
      };

      const response = await axios(options);
      console.log(response.data);
      return response.data?.data?.answer;
    };
    // console.log(joinedString);
    const answer = await getNewsChat(joinedString);
    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

const GhostAdminAPI = require("@tryghost/admin-api");

// Configure the client
const api = new GhostAdminAPI({
  url: "https://school-hack.ghost.io",
  // Admin API key goes here
  key: "673b7a668da3120001894b04:11f274d208044c530b0babd02597ad1f9b257114904df1f9f8d483204a66686b",
  version: "v5.0",
});

api.posts
  .add({
    title: "My first draft API post",
    lexical:
      '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Hello, beautiful world! 👋","type":"extended-text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
  })
  .then(() => console.log("Added Sucessfully"))
  .catch((e) => console.log(e.message));

async function getChatSession() {
  const options = {
    method: "POST",
    url: "https://api.on-demand.io/chat/v1/sessions",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      apikey: process.env.ondemand_api_key,
    },
    data: { externalUserId: "HackBrokers" },
  };

  const response = await axios(options);
  console.log(response.data);
  return response?.data?.data?.id;
}

const summarizeContent = async (content) => {
  const sessionid = await getChatSession();
  console.log("Session ID ", sessionid);

  const options = {
    method: "POST",
    url: `https://api.on-demand.io/chat/v1/sessions/${sessionid}/query`,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      apikey: process.env.ondemand_api_key,
    },
    data: {
      responseMode: "sync",
      query: content,
      onlyFulfillment: true,
      modelConfigs: {
        fulfillmentPrompt:
          "Question: {question} and Context: {context} Summarize the content in 150 words.",
      },
      endpointId: "predefined-openai-gpt4o",
    },
  };

  const response = await axios(options);
  console.log(response.data);
  return response.data?.data?.answer;
};

app.post("/v2/serper", async (req, res) => {
  const { message } = req.body;
  // console.log(message);

  let sourcesWithContent = [];
  let sourcesParsed = [];

  try {
    let data = JSON.stringify({ q: message, num: "10" });
    const serp_api = process.env.SERP_API_PERPLEXITY;
    let config = {
      method: "post",
      url: "https://google.serper.dev/images",
      headers: {
        "X-API-KEY": serp_api,
        "Content-Type": "application/json",
      },
      data: data,
    };

    console.log("Making request...");
    const response = await axios(config);
    // console.log(response.data);
    console.log("Request completed.");

    const { images } = response.data;

    // Prepare the sources
    sourcesParsed = images.map((item) => ({
      title: item.title || "No Title",
      link: item.link || "",
      image: item.imageUrl || "",
    }));

    // Fetch page content function
    const fetchPageContent = async (link) => {
      try {
        const response = await axios.get(link, {
          timeout: 5000,
          validateStatus: (status) => status === 200,
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Remove unwanted elements
        $("script").remove(); // Remove JavaScript
        $("style").remove(); // Remove CSS
        $("noscript").remove();
        $("iframe").remove();
        $("link").remove();
        $("meta").remove();
        $("a").remove(); // Remove links

        // Get text content and clean it up
        let content = $("body")
          .text()
          .replace(/\s+/g, " ") // Replace multiple spaces with single space
          .replace(/\n+/g, " ") // Replace newlines with space
          .replace(/\t+/g, " ") // Replace tabs with space
          .replace(/\[.*?\]/g, "") // Remove content within square brackets
          .replace(/\(.*?\)/g, "") // Remove content within parentheses
          .replace(/[^\w\s.,!?-]/g, " ") // Remove special characters except basic punctuation
          .replace(/\s+/g, " ") // Clean up any resulting multiple spaces
          .trim(); // Remove leading/trailing whitespace

        content = await summarizeContent(content);

        return {
          content,
          link,
        };
      } catch (error) {
        console.error(
          `Error fetching page content for ${link}:`,
          error.message
        );
        return { content: "", link };
      }
    };
    // Process and vectorize content function
    const processAndVectorizeContent = async (item) => {
      try {
        const { content: htmlContent } = await fetchPageContent(item.link);

        return {
          searchResults: htmlContent,
          image: item.image,
          title: item.title,
          link: item.link,
        };
      } catch (error) {
        console.error(
          `Error processing content for ${item.link}:`,
          error.message
        );
        // Return a minimal valid object even in case of error
        return {
          searchResults: "",
          image: item.image,
          title: item.title,
          link: item.link,
        };
      }
    };

    // Process all sources with proper error handling
    const results = await Promise.allSettled(
      sourcesParsed.map(processAndVectorizeContent)
    );

    // Filter and transform results
    sourcesWithContent = results
      .filter(
        (result) => result.status === "fulfilled" && result.value.searchResults
      )
      .map((result) => result.value);

    // Prepare response object
    let responseObj = {
      sourcesWithContent,
    };

    res.status(200).json(responseObj);
  } catch (error) {
    console.error("Error occurred:", error.message);
    // Send a proper error response
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      sourcesWithContent: [],
      sourcesParsed: [],
    });
  }
});

app.listen(3000, () => {
  console.log("Server Listening on port 3000");
});
