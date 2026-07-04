from flask import Flask, request, jsonify
from flask_cors import CORS
from simulator import RetirementSimulator
import traceback

app = Flask(__name__)
CORS(app)

@app.route('/api/simulate', methods=['POST'])
def simulate():
    try:
        params = request.json
        
        simulator = RetirementSimulator(
            eur_to_gbp_rate=params['eurToGbpRate'],
            current_net_salary=params['currentNetSalary'],
            months_to_work=params['monthsToWork'],
            current_savings=params['currentSavings'],
            savings_return_rate=params['savingsReturnRate'],
            current_private_pensions=params['currentPrivatePensions'],
            pension_return_rate=params['pensionReturnRate'],
            pension_drawdown_rate=params['pensionDrawdownRate'],
            state_pension_amount_user=params['statePensionAmountUser'],
            state_pension_start_date_user=params['statePensionStartDateUser'],
            state_pension_amount_spouse=params['statePensionAmountSpouse'],
            state_pension_start_date_spouse=params['statePensionStartDateSpouse'],
            state_pension_increase_per_year=params['statePensionIncreasePerYear'],
            mortgage_remaining=params['mortgageRemaining'],
            mortgage_payments=params['mortgagePayments'],
            house_sale_date=params['houseSaleDate'],
            house_sale_price=params['houseSalePrice'],
            savings_threshold=params['savingsThreshold']
        )
        
        result = simulator.run_simulation()
        
        return jsonify({
            'years': result['years'],
            'warnings': result['warnings']
        }), 200
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
