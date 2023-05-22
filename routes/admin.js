var express = require('express');
var router = express.Router();
var productHelpers = require('../helpers/product-helpers')
var userHelpers = require('../helpers/user-helpers')
var fs = require('fs')

const verifyLogin = (req, res, next) => {
  if (req.session.adminLoggedIn)
    next()
  else
    res.redirect('/admin/login')
}

router.get('/', verifyLogin, function (req, res, next) {
  productHelpers.getAllProducts().then((products) => {
    res.render('admin/view-products', { admin: true, products })
  })
})

router.get('/login', (req, res) => {
  if (req.session.adminLoggedIn)
    res.redirect('/admin')
  else {
    res.render('admin/login', { 'loginErr': req.session.adminLoginErr, admin: true })
    req.session.adminLoginErr = false
  }
})

router.post('/login', (req, res) => {
  productHelpers.doAdminLogin(req.body).then((response) => {
    if (response.status) {
      req.session.admin = response.admin
      req.session.adminLoggedIn = true
      res.redirect('/admin')
    }
    else {
      req.session.adminLoginErr = 'Incorrect credentials'
      res.redirect('/admin/login')
    }
  })
})

router.get('/logout', (req, res) => {
  req.session.admin = null
  req.session.adminLoggedIn = false
  res.redirect('/admin')
})

router.get('/add-product', verifyLogin, function (req, res) {
  res.render('admin/add-product', { admin: true })
})

router.post('/add-product', function (req, res) {
  productHelpers.addProduct(req.body, (id) => {
    let image = req.files.Image
    image.mv('./public/product-images/' + id + '.jpg', (err) => {
      if (!err)
        res.render('admin/add-product', { admin: true })
      else
        console.log(err)
    })
  })
})

router.get('/delete-product/', verifyLogin, (req, res) => {
  let proId = req.query.id
  productHelpers.deleteProduct(proId).then((response) => {
    fs.unlink('./public/product-images/' + proId + '.jpg', function (err) {
      if (err)
        throw err;
    })
    res.redirect('/admin')
  })
})

router.get('/edit-product/', verifyLogin, async (req, res) => {
  let product = await productHelpers.getProductDetails(req.query.id)
  console.log(product)
  res.render('admin/edit-product', { product, admin: true })

})

router.post('/edit-product/:id', verifyLogin, (req, res) => {
  productHelpers.updateProduct(req.params.id, req.body).then((response) => {
    res.redirect('/admin')
    if (req.files.Image) {
      let image = req.files.Image
      image.mv('./public/product-images/' + req.params.id + '.jpg')
    }
  })
})

router.get('/all-orders', verifyLogin, (req, res) => {
  productHelpers.allOrders().then((orders) => {
    for (let order of orders) {
      let date = order.date
      const formattedDate = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      order.formattedDate = formattedDate
    }
    res.render('admin/all-orders', { orders, admin: true })
  })
})

router.get('/view-order-products/:id', async (req, res) => {
  let products = await userHelpers.getOrderProducts(req.params.id)
  res.render('user/view-order-products', { products, admin: true })
})

router.get('/all-users', verifyLogin, (req, res) => {
  userHelpers.allUsers().then((users) => {
    res.render('admin/all-users', { users, admin: true })
  })
})

router.post('/change-to-ship', (req, res) => {
  const orderId = req.body.orderId;
  productHelpers.changeToShip(orderId).then(() => {
    res.json({ status: true });
  })
})

module.exports = router;
