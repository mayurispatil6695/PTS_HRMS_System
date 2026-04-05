
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Save, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from '../ui/use-toast';

interface SalaryField {
  id: string;
  label: string;
  type: 'earning' | 'deduction';
  isDefault: boolean;
  isPercentage: boolean;
  value: number;
}

const SalaryTemplateCreator = () => {
  const [templateName, setTemplateName] = useState('');
  const [fields, setFields] = useState<SalaryField[]>([
    { id: '1', label: 'Basic Salary', type: 'earning', isDefault: true, isPercentage: false, value: 0 },
    { id: '2', label: 'HRA', type: 'earning', isDefault: true, isPercentage: true, value: 30 },
    { id: '3', label: 'Medical Allowance', type: 'earning', isDefault: true, isPercentage: false, value: 2000 },
    { id: '4', label: 'PF Deduction', type: 'deduction', isDefault: true, isPercentage: true, value: 12 },
    { id: '5', label: 'Professional Tax', type: 'deduction', isDefault: true, isPercentage: false, value: 200 }
  ]);

  const addField = () => {
    const newField: SalaryField = {
      id: Date.now().toString(),
      label: '',
      type: 'earning',
      isDefault: false,
      isPercentage: false,
      value: 0
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<SalaryField>) => {
    setFields(fields.map(field => 
      field.id === id ? { ...field, ...updates } : field
    ));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(field => field.id !== id && field.isDefault));
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a template name",
        variant: "destructive"
      });
      return;
    }

    const template = {
      id: Date.now().toString(),
      name: templateName,
      fields: fields,
      createdAt: new Date().toISOString()
    };

    const existingTemplates = JSON.parse(localStorage.getItem('salary_templates') || '[]');
    const updatedTemplates = [...existingTemplates, template];
    localStorage.setItem('salary_templates', JSON.stringify(updatedTemplates));

    toast({
      title: "Template Saved",
      description: `Salary template "${templateName}" has been created successfully`
    });

    setTemplateName('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Create Salary Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="templateName">Template Name</Label>
            <Input
              id="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Standard Salary Template"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Salary Components</h3>
              <Button onClick={addField} size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Add Field
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="Field Label"
                      disabled={field.isDefault}
                    />
                  </div>
                  <select
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value as 'earning' | 'deduction' })}
                    className="px-3 py-2 border rounded-md"
                    disabled={field.isDefault}
                  >
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={field.value}
                      onChange={(e) => updateField(field.id, { value: parseFloat(e.target.value) || 0 })}
                      placeholder="Value"
                      className="w-20"
                    />
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={field.isPercentage}
                        onChange={(e) => updateField(field.id, { isPercentage: e.target.checked })}
                      />
                      %
                    </label>
                  </div>
                  {!field.isDefault && (
                    <Button
                      onClick={() => removeField(field.id)}
                      size="sm"
                      variant="outline"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={saveTemplate} className="w-full">
            <Save className="h-3 w-3 mr-1" />
            Save Template
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SalaryTemplateCreator;
