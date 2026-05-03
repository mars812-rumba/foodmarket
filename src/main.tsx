import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import  Home  from "./pages/Home"
import AdminApp from "./pages/AdminApp"
import { Catalog } from './pages/Catalog'
import { Product } from './pages/Product'
import { NotFound } from './pages/NotFound'
import ProductsPage from './pages/admin/ProductsPage'
import LoginPage from './pages/admin/LoginPage'
import RestManager from './pages/admin/RestManager'
import MenuManager from './pages/admin/MenuManager'
import CRMPage from './pages/admin/CRMPage'
import OrdersDashboard from './pages/admin/OrdersDashboard'
import RestaurantDashboard from './pages/RestaurantDashboard'
import { CartProvider } from './contexts/CartContext'
import { TelegramProvider } from './contexts/TelegramContext'
import { OrderProvider } from './contexts/OrderContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TelegramProvider>
      <CartProvider>
        <OrderProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/admin" element={<AdminApp />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/product/:id" element={<Product />} />
              <Route path="/restaurant-dashboard" element={<RestaurantDashboard />} />
              <Route path="/admin/login" element={<LoginPage />} />
              <Route path="/admin/products" element={<ProductsPage />} />
              <Route path="/admin/restaurants" element={<RestManager />} />
              <Route path="/admin/menu" element={<MenuManager />} />
              <Route path="/admin/crm" element={<CRMPage />} />
              <Route path="/admin/orders" element={<OrdersDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" />
        </OrderProvider>
      </CartProvider>
    </TelegramProvider>
  </StrictMode>,
)
