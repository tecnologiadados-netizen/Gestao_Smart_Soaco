import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateCsrf } from '../middleware/csrf.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  deleteProdutoCubagemHandler,
  deleteVeiculo,
  getPedidoItensCubagem,
  getProdutoCubagemById,
  getProdutosCubagem,
  getVeiculoById,
  getVeiculos,
  postSimulacaoCalcular,
  postVeiculo,
  putProdutoCubagem,
  putVeiculo,
} from '../controllers/cubagemController.js';

const router = Router();
router.use(requireAuth);

const verLogistica = requirePermission(
  PERMISSOES.LOGISTICA_VER,
  PERMISSOES.LOGISTICA_TOTAL,
  PERMISSOES.LOGISTICA_CUBAGEM_VER
);

const editarCubagem = requirePermission(
  PERMISSOES.LOGISTICA_CUBAGEM_EDITAR,
  PERMISSOES.LOGISTICA_TOTAL
);

// Veículos (placa + dimensões da carroceria)
router.get('/cubagem/veiculos', verLogistica, getVeiculos);
router.get('/cubagem/veiculos/:id', verLogistica, getVeiculoById);
router.post('/cubagem/veiculos', validateCsrf, editarCubagem, postVeiculo);
router.put('/cubagem/veiculos/:id', validateCsrf, editarCubagem, putVeiculo);
router.delete('/cubagem/veiculos/:id', validateCsrf, editarCubagem, deleteVeiculo);

// Produtos (dimensões/peso)
router.get('/cubagem/produtos', verLogistica, getProdutosCubagem);
router.get('/cubagem/produtos/:idProduto', verLogistica, getProdutoCubagemById);
router.put('/cubagem/produtos/:idProduto', validateCsrf, editarCubagem, putProdutoCubagem);
router.delete('/cubagem/produtos/:idProduto', validateCsrf, editarCubagem, deleteProdutoCubagemHandler);

// Simulação de cubagem
router.get('/cubagem/pedidos/:pd/itens', verLogistica, getPedidoItensCubagem);
router.post('/cubagem/simulacao/calcular', validateCsrf, verLogistica, postSimulacaoCalcular);

export default router;
