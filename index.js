// Load the correct environment variables
require('dotenv').config();

// Needed for the optional output to file
const fs = require('fs');

// Optional modules to make CLI development easier
const program = require('commander');
const cliProgress = require('cli-progress');

// Fake data generation helpers
const faker = require('faker');
const RandomGenerator = require('./lib/RandomGenerator').RandomGenerator;
const randomGenerator = setupRandomGenerator();


// commercetools SDK / Middleware
const fetch = require('node-fetch');
const createAuthMiddlewareForClientCredentialsFlow = require('@commercetools/sdk-middleware-auth').createAuthMiddlewareForClientCredentialsFlow;
const createHttpMiddleware = require('@commercetools/sdk-middleware-http').createHttpMiddleware;
const createClient = require('@commercetools/sdk-client').createClient;
const createApiBuilderFromCtpClient = require('@commercetools/importapi-sdk').createApiBuilderFromCtpClient;

// Create the authentication middleware
const authMiddleware = createAuthMiddlewareForClientCredentialsFlow({
  host: process.env.AUTH_HOST,
  projectKey: process.env.PROJECT_KEY,
  credentials: {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  },
  scopes: [
    `manage_project:${process.env.PROJECT_KEY}`
  ],
  fetch,
})

// Create the HTTP middleware to connect to the IMPORT API
const httpMiddleware = createHttpMiddleware({
  host: process.env.IMPORT_API_HOST,
  fetch,
})

// Create the SDK client used by the API root
const client = createClient({
  middlewares: [authMiddleware, httpMiddleware],
})

// Finally, create the API Root (Request builder to the Import API)
const apiRoot = createApiBuilderFromCtpClient(client)

// Some global variables
let writeStream;

// Setup the command and options
program
  .command('generate <numOfRecords> <destination>')
  .description('Creates and imports random data to the destination sink')
  .option('-f, --file', 'output to file instead')
  .option('-b, --batchSize <size>', 'Batch size to generate (max. 20, default 20)')
  .action((numOfRecords, destination, opts) => {

    // Process the batch size
    let batchSize = opts.batchSize || 20;

    // Some very basic validations of the batch size
    if (batchSize > numOfRecords) {
      batchSize = numOfRecords;
    }

    if (batchSize > 20) {
      batchSize = 20;
    }

    // This version of the script contains an "offline" mode so you can see the JSON output before posting it to the sink
    const offlineMode = (opts.file);

    if (opts.file) {
      // Create a file stream
      console.log(`Outputting to file ${destination}`)
      writeStream = fs.createWriteStream(destination);
    }

    // Calculate the amount of runs
    let runs = Math.round(numOfRecords / batchSize);
    
    // Setup a progress bar
    const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar1.start(runs, 0);

    const runBatch = async () => {
      for (var currentBatch = 0; currentBatch < runs; currentBatch++) {
        // Generate a batch of randomized product data
        await randomGenerator.generateBatch(batchSize).then(async data => {
          // When run in offlineMode, write the data to the stream.
          if (offlineMode) {
            await writeToStream(currentBatch, data).then(() => {
              // Update the bar with the progress
              bar1.update(currentBatch);
            })
          } else {
            await importNewProducts(destination, data).then((response) => {
              // Update the bar with the progress
              bar1.update(currentBatch);
            })
          }
        })
      }

      // End the wait for updates on the progress bar
      bar1.stop();

      // Close the file 
      if (offlineMode) {
        writeStream.end();
      }
    }

    // Start the run
    runBatch();
  });

program.parse(process.argv);

async function writeToStream(currentBatch, data) {
  let output = {
    "batch": currentBatch,
    "resources": data
  };

  return new Promise((resolve, reject) => {
    writeStream.write(JSON.stringify(output) + ',');
    resolve();
  });
}

async function importNewProducts(name, resources) {
  try {
    return apiRoot.withProjectKeyValue({
      projectKey: process.env.PROJECT_KEY
    }).
    productDrafts().importSinkKeyWithImportSinkKeyValue({
      importSinkKey: name
    }).post({
      body: {
        type: "product-draft",
        resources: resources
      }
    }).execute().then(response => {
      return response;
    }).catch(error => {
      throw error;
    });
  } catch (e) {
    throw e;
  }
}

function setupRandomGenerator() {
  let randomProductGenerator = new RandomGenerator('default', "nl-BE");

  randomProductGenerator.keyTemplate = (id) => {
    return `product-${id}-key`;
  }

  randomProductGenerator.slugTemplate = (id) => {
    return {
      "nl-BE": `product-${id}-slug`
    }
  }

  randomProductGenerator.pricesTemplate = (countryCode) => {
    return {
      "value": {
        "type": "centPrecision",
        "currencyCode": "EUR",
        "centAmount": Math.floor(Math.random() * Math.floor(1000)) * 100
      }
    }
  }

  randomProductGenerator.masterVariantKeyTemplate = (id) => {
    return `product-variant-${id}-key`;
  }

  randomProductGenerator.masterVariantSKUTemplate = (id) => {
    return `product-variant-SKU-${id}`;
  }

  randomProductGenerator.modify = (id, obj) => {
    obj.masterVariant.attributes.push({
      "name": "DisplayProductNumber",
      "type": "text",
      "value": faker.lorem.word()
    });

    obj.masterVariant.attributes.push({
      "name": "SearchName",
      "type": "text",
      "value": faker.lorem.word()
    });

    obj.masterVariant.attributes.push({
      "name": "HarmonizedSystemCode",
      "type": "text",
      "value": faker.lorem.word()
    });

    obj.masterVariant.attributes.push({
      "name": "NMFCCode",
      "type": "text",
      "value": faker.lorem.word()
    });

    obj.masterVariant.images = [{
      "url": faker.image.imageUrl(800, 600),
      "dimensions": {
        "w": 800,
        "h": 600
      },
      "label": "image"
    }]

    obj.publish = true;

    obj.categories = [{
      "typeId": "category",
      "key": "imported"
    }];

    obj.taxCategory = {
      "typeId": "tax-category",
      "key": "standard"
    }
    return obj;
  }

  return randomProductGenerator;
}