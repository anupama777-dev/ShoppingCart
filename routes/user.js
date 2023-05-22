var express = require('express');
var router = express.Router();
var productHelpers = require('../helpers/product-helpers');
var userHelpers = require('../helpers/user-helpers')

const verifyLogin = (req, res, next) => {
  if (req.session.userLoggedIn)
    next()
  else
    res.redirect('/login')
}

router.get('/', async (req, res, next) => {
  let user = req.session.user
  let cartCount = null
  if (user)
    cartCount = await userHelpers.getCartCount(user._id)
  productHelpers.getAllProducts().then((products) => {
    res.render('user/view-products', { products, user, cartCount })
  })
});

router.get('/login', (req, res) => {
  if (req.session.userLoggedIn)
    res.redirect('/')
  else {
    res.render('user/login', { 'loginErr': req.session.userLoginErr })
    req.session.userLoginErr = false
  }
})

router.get('/signup', (req, res) => {
  res.render('user/signup')
})

router.post('/signup', (req, res) => {
  userHelpers.doSignup(req.body).then((response) => {
    req.session.user = response.user
    req.session.userLoggedIn = true
    res.redirect('/')
  })
})

router.post('/login', (req, res) => {
  userHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.user = response.user
      req.session.userLoggedIn = true
      res.redirect('/')
    }
    else {
      req.session.userLoginErr = 'Incorrect credentials'
      res.redirect('/login')
    }
  })
})

router.get('/logout', (req, res) => {
  req.session.user = null
  req.session.userLoggedIn = false
  res.redirect('/')
})

router.get('/profile', verifyLogin, async(req, res) => {
  let userExist = req.session.user
  let cartCount = null
  if(userExist)
    cartCount = await userHelpers.getCartCount(userExist._id)
  userHelpers.getUserDetails(userExist._id).then((user) => {
    res.render('user/profile', {user, cartCount})
  })
})

router.get('/edit-profile', verifyLogin, async(req, res) => {
  let userExist = req.session.user
  let cartCount = null
  if (userExist)
    cartCount = await userHelpers.getCartCount(userExist._id)
  userHelpers.getUserDetails(userExist._id).then((user) => {
    res.render('user/edit-profile', {user, cartCount})
  })
})

router.post('/edit-profile/:id', (req, res) => {
  userHelpers.updateUserDetails(req.params.id, req.body).then(() => {
    res.redirect('/profile')
  })
})

router.get('/cart', verifyLogin, async (req, res) => {
  let user = req.session.user
  let total = 0
  let cartCount = null
  let products = await userHelpers.getCartProducts(user._id)
  if (products.length > 0)
    total = await userHelpers.getTotalAmount(user._id)
  if (user)
    cartCount = await userHelpers.getCartCount(user._id)
  res.render('user/cart', { products, user, total, cartCount })
})

router.get('/add-to-cart/:id', (req, res) => {
  userHelpers.addToCart(req.params.id, req.session.user._id).then((response) => {
    if (response.status)
      res.json({ status: true })
  })
})

router.post('/change-product-quantity', (req, res) => {
  userHelpers.changeProductQuantity(req.body).then(async (response) => {
    response.total = await userHelpers.getTotalAmount(req.body.user)
    res.json(response)
  })
})

router.post('/remove-product', (req, res) => {
  userHelpers.removeProduct(req.body).then((response) => {
    res.json(response)
  })
})

router.get('/place-order', verifyLogin, async (req, res) => {
  let user = req.session.user
  let total = await userHelpers.getTotalAmount(user._id)
  res.render('user/place-order', { total, user })
})

router.post('/place-order', async (req, res) => {
  let products = await userHelpers.getCartProductsList(req.body.UserId)
  let totalPrice = await userHelpers.getTotalAmount(req.body.UserId)
  userHelpers.placeOrder(req.body, products, totalPrice).then((orderId) => {
    if (req.body['payment-method'] === 'COD')
      res.json({ codSuccess: true })
    else
      userHelpers.generateRazorpay(orderId, totalPrice).then((response) => {
        res.json(response)
      })
  })
})

router.get('/order-success', async (req, res) => {
  let orderId = await userHelpers.getOrderId(req.session.user._id)
  res.render('user/order-success', { orderId })
})

router.get('/orders', async (req, res) => {
  let user = req.session.user
  let cartCount = null
  if (user)
    cartCount = await userHelpers.getCartCount(user._id)
  let orders = await userHelpers.getUserOrders(user._id)
  for (let order of orders) {
    let date = order.date
    const formattedDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
    order.formattedDate = formattedDate
  }
  res.render('user/orders', { user, orders, cartCount })
})

router.get('/view-order-products/:id', async (req, res) => {
  let user = req.session.user
  let cartCount = null
  if (user)
    cartCount = await userHelpers.getCartCount(user._id)
  let products = await userHelpers.getOrderProducts(req.params.id)
  res.render('user/view-order-products', { user: req.session.user, products, cartCount })
})

router.post('/verify-payment', (req, res) => {
  console.log(req.body)
  userHelpers.verifyPayment(req.body).then(() => {
    userHelpers.changePaymentStatus(req.body['order[receipt]']).then(() => {
      res.json({ status: true })
    })
  }).catch((err) => {
    console.log(err)
    res.json({ status: false, errMsg: 'Payment failed' })
  })
})

module.exports = router;
