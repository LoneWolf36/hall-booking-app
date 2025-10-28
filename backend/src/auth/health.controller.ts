import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SmsService } from '../common/services/sms.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/dto/create-user.dto';

/**
 * Health & Monitoring Controller
 * 
 * Provides system health checks and monitoring endpoints.
 * Admin-only access for production monitoring.
 */
@ApiTags('Health & Monitoring')
@ApiBearerAuth()
@Controller('health')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HealthController {
  constructor(private readonly smsService: SmsService) {}

  /**
   * GET /health/sms - SMS Service Health Check
   * 
   * Returns SMS service status and delivery metrics.
   * Useful for monitoring OTP delivery success rates.
   * 
   * **Admin Only**
   * 
   * @returns SMS service health status and metrics
   */
  @Get('sms')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check SMS service health and metrics',
    description: 'Returns SMS provider status, delivery metrics, and success rates. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'SMS service health retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          healthy: true,
          provider: 'Msg91Provider',
          metrics: {
            totalSent: 1250,
            totalSuccess: 1235,
            totalFailed: 15,
            successRate: 98.8,
            lastSentAt: '2025-10-28T10:30:00.000Z',
            lastError: null,
          },
          recommendations: [
            'Success rate is healthy (>95%)',
          ],
        },
      },
    },
  })
  async getSmsHealth(): Promise<{
    success: boolean;
    data: {
      healthy: boolean;
      provider: string;
      metrics: any;
      recommendations: string[];
    };
  }> {
    const health = await this.smsService.healthCheck();
    const metrics = health.metrics;

    // Generate recommendations based on metrics
    const recommendations: string[] = [];
    
    if (metrics.successRate >= 95) {
      recommendations.push('✅ Success rate is healthy (>95%)');
    } else if (metrics.successRate >= 90) {
      recommendations.push('⚠️  Success rate is acceptable (90-95%). Monitor closely.');
    } else {
      recommendations.push('❌ Success rate is low (<90%). Investigate delivery issues.');
    }

    if (metrics.totalFailed > 100) {
      recommendations.push(`⚠️  High failure count: ${metrics.totalFailed} messages failed`);
    }

    if (metrics.lastError) {
      recommendations.push(`⚠️  Last error: ${metrics.lastError}`);
    }

    if (health.provider === 'ConsoleProvider') {
      recommendations.push('ℹ️  Using console provider (development mode)');
    }

    return {
      success: true,
      data: {
        ...health,
        recommendations,
      },
    };
  }
}
