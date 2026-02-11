import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsValidProjectYearConstraint implements ValidatorConstraintInterface {
  validate(dateStr: string, args: ValidationArguments) {
    if (!dateStr) return true;
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    const year = date.getUTCFullYear(); 
    const currentYear = new Date().getUTCFullYear();

    return year >= currentYear - 1 && year <= currentYear + 1;
  }

  defaultMessage(args: ValidationArguments) {
    const currentYear = new Date().getFullYear();
    return `La fecha debe ser del año anterior (${currentYear - 1}), actual (${currentYear}) o siguiente (${currentYear + 1})`;
  }
}

export function IsCurrentOrNextYear(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidProjectYearConstraint,
    });
  };
}