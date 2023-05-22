const db = require('../config/connection')
const collection = require('../config/collections')
const bcrypt = require('bcrypt')
const { response } = require('express')
var objectId = require('mongodb').ObjectId
const Razorpay = require('razorpay')
const { resolve } = require('path')
const { rejects } = require('assert')
const { resourceLimits } = require('worker_threads')
var instance = new Razorpay({
    key_id: 'rzp_test_NTeErDaUJrPHUf',
    key_secret: 'U89ojockctRlJKYR0fCWVOOL'
})

module.exports = {

    doSignup: (userData) => {
        return new Promise(async (resolve, reject) => {

            userData.Password = await bcrypt.hash(userData.Password, 10)
            db.collection(collection.USER_COLLECTION).insertOne(userData).then((data) => {
                resolve(userData)
            })
        })
    },

    doLogin: (userData) => {
        return new Promise(async (resolve, reject) => {
            let loginStatus = false
            let response = {}
            let user = await db.collection(collection.USER_COLLECTION).findOne({ Email: userData.Email })
            if (user) {
                bcrypt.compare(userData.Password, user.Password).then((status) => {
                    if (status) {
                        response.user = user
                        response.status = true
                        resolve(response)
                    }
                    else {
                        resolve({ status: false })
                    }
                })
            }
            else {
                resolve({ status: false })
            }
        })
    },

    addToCart: (proId, userId) => {
        let proObj = {
            item: new objectId(proId),
            quantity: 1
        }
        return new Promise(async (resolve, reject) => {
            let userCart = await db.collection(collection.CART_COLLECTION).findOne({ User: new objectId(userId) })
            if (userCart) {
                let proExist = userCart.Products.findIndex(product => product.item == proId)
                if (proExist != -1) {
                    db.collection(collection.CART_COLLECTION).updateOne({ User: new objectId(userId), 'Products.item': new objectId(proId) },
                        {
                            $inc: {
                                'Products.$.quantity': 1
                            }
                        }).then((response) => {
                            resolve({ status: false })
                        })
                }
                else {
                    db.collection(collection.CART_COLLECTION).updateOne({ User: new objectId(userId) },

                        {
                            $push: { Products: proObj }
                        }).then((response) => {

                            resolve({ status: true })
                        })
                }
            }
            else {
                let cartObj = {
                    User: new objectId(userId),
                    Products: [proObj]
                }
                db.collection(collection.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve({ status: true })
                })
            }
        })
    },

    getCartProducts: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { User: new objectId(userId) },
                },
                {
                    $unwind: '$Products'
                },
                {
                    $project: {
                        item: '$Products.item',
                        quantity: '$Products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                }
            ]).toArray()
            resolve(cartItems)
        })
    },

    getCartCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let count = 0
            let cart = await db.collection(collection.CART_COLLECTION).findOne({ User: new objectId(userId) })
            if (cart)
                count = cart.Products.length
            resolve(count)
        })
    },

    changeProductQuantity: (details) => {
        details.count = parseInt(details.count)
        details.quantity = parseInt(details.quantity)
        return new Promise((resolve, reject) => {
            if (details.count == -1 && details.quantity == 1) {
                db.collection(collection.CART_COLLECTION)
                    .updateOne({ _id: new objectId(details.cart) },
                        {
                            $pull: { Products: { item: new objectId(details.product) } }
                        }).then((response) => {
                            resolve({ removeProduct: true })
                        })
            }
            else {
                db.collection(collection.CART_COLLECTION)
                    .updateOne({ _id: new objectId(details.cart), 'Products.item': new objectId(details.product) },
                        {
                            $inc: {
                                'Products.$.quantity': details.count
                            }
                        }).then((response) => {
                            resolve({ status: true })
                        })
            }
        })
    },

    removeProduct: (details) => {
        let cartId = details.cartId
        let proId = details.proId
        return new Promise((resolve, reject) => {
            db.collection(collection.CART_COLLECTION)
                .updateOne({ _id: new objectId(cartId) },
                    {
                        $pull: { Products: { item: new objectId(proId) } }
                    }).then((response) => {
                        resolve({ removeProduct: true })
                    })
        })
    },

    getTotalAmount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let total = await db.collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { User: new objectId(userId) },
                },
                {
                    $unwind: '$Products'
                },
                {
                    $project: {
                        item: '$Products.item',
                        quantity: '$Products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $multiply: [{ $toDouble: '$quantity' }, { $toDouble: '$product.Price' }] } }
                    }
                }
            ]).toArray()
            resolve(total[0].total)
        })
    },

    getCartProductsList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db.collection(collection.CART_COLLECTION).findOne({ User: new objectId(userId) })
            resolve(cart.Products)
        })
    },

    placeOrder: (order, products, total) => {
        return new Promise((resolve, reject) => {
            let status = order['payment-method'] === 'COD' ? 'placed' : 'pending'
            let orderObj = {
                deliveryDetails: {
                    address: order.Address,
                    pincode: order.Pincode,
                    mobile: order.Mobile
                },
                userId: new objectId(order.UserId),
                paymentMethod: order['payment-method'],
                products: products,
                status: status,
                total: total,
                date: new Date()
            }
            db.collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response) => {
                db.collection(collection.CART_COLLECTION).deleteOne({ User: new objectId(order.UserId) })
                db.collection(collection.USER_COLLECTION).updateOne({ _id: new objectId(order.UserId) }, {
                    $set: {
                        'Address': order.Address,
                        'Pincode': order.Pincode,
                        'Phone': order.Mobile
                    }
                })
                resolve(response.insertedId)
            })
        })
    },

    getOrderId: (userId) => {
        return new Promise(async (resolve, reject) => {
            let order = await db.collection(collection.ORDER_COLLECTION).findOne({ userId: new objectId(userId) })
            resolve(order._id)
        })
    },

    getUserOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db.collection(collection.ORDER_COLLECTION).find({ userId: new objectId(userId) }).toArray()
            resolve(orders)
        })
    },

    getOrderProducts: (orderId) => {
        return new Promise(async (resolve, reject) => {
            let orderItems = await db.collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { _id: new objectId(orderId) },
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                }
            ]).toArray()
            resolve(orderItems)
        })
    },

    generateRazorpay: (orderId, total) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: total * 100,
                currency: 'INR',
                receipt: "" + orderId
            }
            instance.orders.create(options, (err, order) => {
                console.log(order)
                resolve(order)
            })
        })
    },

    verifyPayment: (details) => {
        return new Promise((resolve, reject) => {
            const crypto = require('crypto')
            let hmac = crypto.createHmac('sha256', 'U89ojockctRlJKYR0fCWVOOL')
            hmac.update(details['payment[razorpay_order_id]'] + '|' + details['payment[razorpay_payment_id]'])
            hmac = hmac.digest('hex')
            if (hmac == details['payment[razorpay_signature]'])
                resolve()
            else
                reject()
        })
    },

    changePaymentStatus: (orderId) => {
        return new Promise((resolve, reject) => {
            db.collection(collection.ORDER_COLLECTION)
                .updateOne({ _id: new objectId(orderId) }, {
                    $set: {
                        status: 'placed'
                    }
                }).then(() => {
                    resolve()
                })
        })
    },

    allUsers: () => {
        return new Promise(async (resolve, reject) => {
            let users = await db.collection(collection.USER_COLLECTION).find().toArray()
            resolve(users)
        })
    },

    getUserDetails: (userId) => {
        return new Promise(async (resolve, reject) => {
            let user = await db.collection(collection.USER_COLLECTION).findOne({ _id: new objectId(userId) })
            resolve(user)
        })
    },

    updateUserDetails: (userId, userDetails) => {
        return new Promise((resolve, reject) => {
            db.collection(collection.USER_COLLECTION).updateOne({ _id: new objectId(userId)}, {
                $set: {
                    Name: userDetails.Name,
                    Email: userDetails.Email,
                    Address: userDetails.Address,
                    Pincode: userDetails.Pincode,
                    Phone: userDetails.Mobile
                }
            })
            resolve()
        })
    }
}