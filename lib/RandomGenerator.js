const _ = require('lodash');
const faker = require('faker');

class RandomGenerator {

  constructor(productTypeKey, localizations) {    
    this.count = 0;
    this.localizations = localizations;

    if (!Array.isArray(localizations)) {
      this.localizations = [];
      this.localizations[0] = localizations;
    }
    
    this.productTypeKey = productTypeKey;
    this.template = {
      "key" : "product-draft-key",
      "name" : {       
      },
     "description": {
      },
      "slug" : {        
      },
      "productType" : {
        "typeId" : "product-type",
        "key" : this.productTypeKey
      },
      "masterVariant" : {
        "key": "product-variant-draft-key",
        "sku": "product-variant-draft-sku",
        "prices": [          
        ],
        "attributes" : [ 
        ]
      }
    }
  }

  build(id) {
    let self = this;

    // Use the faker library to generate the right things
    let obj = _.cloneDeep(self.template);

    obj.key = self.keyTemplate(id);

    obj.masterVariant.key = self.masterVariantKeyTemplate(id);       
    obj.masterVariant.sku = self.masterVariantSKUTemplate(id);
    obj.masterVariant.prices[0] = self.pricesTemplate();

    self.localizations.forEach(localization => {
      obj.name[localization] = faker.commerce.productName();
      obj.description[localization] = faker.commerce.productDescription();
      obj.slug[localization] = self.slugTemplate(id, localization);
    });
      
    return obj;
  }
  

  keyTemplate(id) {    
    return `product-${id}-key`;
  }

  slugTemplate(id, localization) {      
    return `product-${id}-slug`;    
  }

  pricesTemplate(countryCode) {
    return {
      "value": {
        "type": "centPrecision",        
        "currencyCode" : "EUR",
        "centAmount" : Math.floor(Math.random() * Math.floor(1000)) *100 
      }
    }
  }

  masterVariantKeyTemplate(id) {
    return   `product-variant-${id}-key`;    
  }

  masterVariantSKUTemplate(count) {
    return `product-variant-SKU-${id}`;
  }

  modify(count, object) {
    return object;
  }

  async generateBatch(quantity) {
    let self = this;

    return new Promise((resolve, reject) => {

      let results = [];

      for (var i=0;i<quantity;i++) {  
        results[i] = this.generateSingle();
        self.count++;
      }
  
      Promise.all(results).then(result => {
        resolve(result);
      })
    })
  }


  async generateSingle() {
    let self = this;
      
    return new Promise((resolve, reject) => {    
        const id = Math.floor(Math.random() * Math.floor(100000)) *100 ;
        let x = self.build(id);        
        x = self.modify(id, x);

        resolve(x);
    });
  }
}

module.exports = {
  RandomGenerator:RandomGenerator
};