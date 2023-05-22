const db = require('../config/connection')
const collection = require('../config/collections');
const { response } = require('express');
var objectId = require('mongodb').ObjectId

module.exports = {

  doAdminLogin: (details) => {
    return new Promise(async(resolve, reject) => {
      let response = {}
      let admin = await db.collection(collection.ADMIN_COLLECTION).findOne({Email: details.Email, Password: details.Password})
      if(admin){
        response.admin = admin
        response.status = true
        resolve(response)
      }
      else
        resolve({status: false})
  })
  },

  addProduct: (product, callback) => {
    db.collection(collection.PRODUCT_COLLECTION).insertOne(product).then((data) => {

      callback(data.insertedId);
    });
  },

  getAllProducts: () => {

    return new Promise(async (resolve, reject) => {

      let products = await db.collection(collection.PRODUCT_COLLECTION).find().toArray()
      resolve(products)
    })
  },

  deleteProduct: (prodId) => {
    return new Promise((resolve, reject) => {
      db.collection(collection.PRODUCT_COLLECTION).deleteOne({ _id: new objectId(prodId) }).then((response) => {
        resolve(response)
      })
    })
  },

  getProductDetails: (prodId) => {
    return new Promise((resolve, reject) => {
      db.collection(collection.PRODUCT_COLLECTION).findOne({ _id: new objectId(prodId) }).then((product) => {
        resolve(product)
      })
    })
  },

  updateProduct: (prodId, prodDetails) => {
    return new Promise((resolve, reject) => {
      db.collection(collection.PRODUCT_COLLECTION).updateOne({ _id: new objectId(prodId)}, {
        $set: {
          Name: prodDetails.Name,
          Category: prodDetails.Category,
          Price: prodDetails.Price,
          Description: prodDetails.Description
        }
      }).then((response) => {
        resolve(response)
      })
    })
  },

  allOrders: () => {
    return new Promise(async(resolve, reject) => {
      let orders = await db.collection(collection.ORDER_COLLECTION).find().toArray()
      resolve(orders)
    })
  },

  changeToShip: (orderId) => {
    return new Promise((resolve, reject) => {
      db.collection(collection.ORDER_COLLECTION).updateOne({_id: new objectId(orderId)},{
        $set: {
          status: 'shipped'
        }
      }).then(() => {
        resolve()
      })
    })
  }

};