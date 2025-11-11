import { Controller, Get, Post, Put, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { OrderService, CreateOrderDto } from './order.service';
import { OrderEvent } from './order.entity';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    try {
      return await this.orderService.createOrder(dto);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  async getAllOrders() {
    return await this.orderService.getAllOrders();
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    const order = await this.orderService.getOrder(id);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    return order;
  }

  @Get('customer/:customerId')
  async getCustomerOrders(@Param('customerId') customerId: string) {
    return await this.orderService.getCustomerOrders(customerId);
  }

  @Put(':id/event')
  async processEvent(
    @Param('id') id: string,
    @Body() body: { event: OrderEvent; payload?: any }
  ) {
    try {
      return await this.orderService.processWorkflowEvent(id, body.event, body.payload);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/pay')
  async initiatePayment(@Param('id') id: string) {
    try {
      return await this.orderService.processWorkflowEvent(id, OrderEvent.INITIATE_PAYMENT);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body() body: { reason?: string }
  ) {
    try {
      return await this.orderService.processWorkflowEvent(id, OrderEvent.CANCEL, {
        cancellationReason: body.reason || 'Customer requested cancellation'
      });
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/ship')
  async shipOrder(@Param('id') id: string) {
    try {
      return await this.orderService.processWorkflowEvent(id, OrderEvent.SHIP);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/deliver')
  async deliverOrder(@Param('id') id: string) {
    try {
      return await this.orderService.processWorkflowEvent(id, OrderEvent.DELIVER);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/refund')
  async refundOrder(
    @Param('id') id: string,
    @Body() body: { amount?: number }
  ) {
    try {
      return await this.orderService.processWorkflowEvent(id, OrderEvent.PROCESS_REFUND, {
        refundAmount: body.amount
      });
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}